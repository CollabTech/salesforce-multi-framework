"""Offline unit tests for SMF-1 GOV-01/GOV-03 portability fixes.

Run: python3 -m unittest discover -s scripts/tests -v
"""
import importlib.util, os, shutil, sys, tempfile, unittest
from pathlib import Path, PureWindowsPath
from unittest import mock

SCRIPTS = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SCRIPTS))
import smfskills as S  # noqa: E402

spec = importlib.util.spec_from_file_location("build_index", SCRIPTS / "build-test-plan-index.py")
build_index = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build_index)

def rel(name: str) -> str:
    """OS-native relative link target (Windows symlinks need backslashes)."""
    return os.path.join("..", "..", ".agents", "skills", name)


SKILL = "---\nname: {n}\ndescription: test skill\n---\n\nbody\n"


class IndexPaths(unittest.TestCase):
    def test_windows_paths_become_posix(self):
        root = PureWindowsPath(r"C:\work\salesforce-multi-framework")
        p = root / "docs" / "jira-snapshot" / "2026-10-03" / "SMF-1.md"
        self.assertEqual(build_index.rel_posix(p, root), "docs/jira-snapshot/2026-10-03/SMF-1.md")

    def test_markdown_links_use_forward_slashes(self):
        idx = build_index.build(build_index.latest_snapshot())
        md = build_index.render_markdown(idx)
        self.assertNotIn("\\", md)
        for s in idx["stories"]:
            self.assertNotIn("\\", s["snapshot"])


class BlobIntegrity(unittest.TestCase):
    def test_lf_crlf_and_tamper(self):
        lf = b"line one\nline two\n"
        want = S.git_blob_id(lf)
        self.assertTrue(S.file_matches(lf, want))
        self.assertTrue(S.file_matches(lf.replace(b"\n", b"\r\n"), want))   # autocrlf checkout
        self.assertFalse(S.file_matches(b"line one\nline 2\n", want))        # real change
        self.assertFalse(S.file_matches(lf + b"\n", want))                   # appended byte

    def test_git_blob_id_matches_git(self):
        # `printf 'hello\n' | git hash-object --stdin`
        self.assertEqual(S.git_blob_id(b"hello\n"), "ce013625030ba8dba906f756967f9e9ca394464a")


class ClaudeEntries(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.tmp)
        self.agents = self.tmp / ".agents" / "skills"
        self.claude = self.tmp / ".claude" / "skills"
        for n in ("smf-a", "smf-b"):
            (self.agents / n).mkdir(parents=True)
            (self.agents / n / "SKILL.md").write_text(SKILL.format(n=n), encoding="utf-8")
        self.claude.mkdir(parents=True)
        p1 = mock.patch.object(S, "AGENTS_DIR", self.agents)
        p2 = mock.patch.object(S, "CLAUDE_DIR", self.claude)
        p1.start(); p2.start()
        self.addCleanup(p1.stop); self.addCleanup(p2.stop)

    def test_missing(self):
        self.assertIn("missing", S.verify_claude_entry("smf-a")[0])

    def test_text_placeholder_rejected(self):
        (self.claude / "smf-a").write_text("../../.agents/skills/smf-a", encoding="utf-8")
        err = S.verify_claude_entry("smf-a")
        self.assertTrue(err and "text placeholder" in err[0], err)

    def test_wrong_target_rejected(self):
        os.symlink(rel("smf-b"), self.claude / "smf-a", target_is_directory=True)
        err = S.verify_claude_entry("smf-a")
        self.assertTrue(err and "wrong target" in err[0], err)

    def test_dangling_rejected(self):
        os.symlink(rel("nope"), self.claude / "smf-a", target_is_directory=True)
        self.assertTrue(S.verify_claude_entry("smf-a"))

    def test_symlink_ok_and_repair(self):
        (self.claude / "smf-a").write_text("../../.agents/skills/smf-a", encoding="utf-8")
        self.assertEqual(S.make_dir_link(self.claude / "smf-a", self.agents / "smf-a"), "symlink")
        self.assertEqual(S.verify_claude_entry("smf-a"), [])

    def test_copy_fallback_when_symlinks_unavailable(self):
        with mock.patch.object(S.os, "symlink", side_effect=OSError("privilege not held")), \
             mock.patch.object(S.os, "name", "posix"):
            kind = S.make_dir_link(self.claude / "smf-a", self.agents / "smf-a")
        self.assertEqual(kind, "copy")
        self.assertEqual(S.verify_claude_entry("smf-a"), [])
        (self.agents / "smf-a" / "SKILL.md").write_text(SKILL.format(n="smf-a") + "changed\n", encoding="utf-8")
        self.assertIn("differs", S.verify_claude_entry("smf-a")[0])

    def test_windows_tries_junction_before_copy(self):
        calls = []
        def fake_run(cmd, **kw):
            calls.append(cmd)
            os.symlink(os.path.relpath(cmd[5], os.path.dirname(cmd[4])), cmd[4], target_is_directory=True)
            return mock.Mock(returncode=0)
        real_symlink = os.symlink
        def deny_first(*a, **k):
            if not calls:
                raise OSError("privilege not held")
            return real_symlink(*a, **k)
        with mock.patch.object(S.os, "symlink", side_effect=deny_first), \
             mock.patch.object(S.os, "name", "nt"), \
             mock.patch.object(S.subprocess, "run", side_effect=fake_run):
            kind = S.make_dir_link(self.claude / "smf-a", self.agents / "smf-a")
        self.assertEqual(kind, "junction")
        self.assertEqual(calls[0][:4], ["cmd", "/c", "mklink", "/J"])


class StaleEntries(ClaudeEntries):
    def test_remove_entry_handles_every_kind(self):
        os.symlink(rel("smf-a"), self.claude / "s1", target_is_directory=True)
        shutil.copytree(self.agents / "smf-a", self.claude / "s2")
        (self.claude / "s3").write_text("placeholder", encoding="utf-8")
        for n in ("s1", "s2", "s3"):
            S.remove_entry(self.claude / n)
            self.assertFalse(os.path.lexists(self.claude / n))
        self.assertTrue((self.agents / "smf-a" / "SKILL.md").exists())  # target untouched


if __name__ == "__main__":
    unittest.main()
