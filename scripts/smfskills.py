"""Shared helpers for the project-scoped skill bootstrap and verification (no network).

Official Salesforce skills are NOT tracked in Git (licence question C-02, ADR-0001 rev 2).
They are installed on demand, pinned to one upstream revision, into .agents/skills/<name>
and verified file-by-file against the upstream Git blob IDs recorded in
docs/provenance/official-skills.json. .claude/skills/<name> entries are generated for
every skill (official and smf-*) and must resolve to the canonical .agents/skills copy.

Integrity is line-ending tolerant but not content tolerant: a file matches when the Git
blob ID of its bytes, or of its bytes with CRLF folded to LF, equals the upstream blob ID.
Any other change, an extra file, or a missing file is a failure.
"""
import hashlib, json, os, shutil, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AGENTS_DIR = ROOT / ".agents" / "skills"
CLAUDE_DIR = ROOT / ".claude" / "skills"
LOCK = ROOT / "skills-lock.json"
PROV = ROOT / "docs" / "provenance" / "official-skills.json"
IGNORED_NAMES = {".DS_Store", "Thumbs.db", "desktop.ini"}


def load_manifest() -> dict:
    return json.loads(PROV.read_text(encoding="utf-8"))


def git_blob_id(data: bytes) -> str:
    return hashlib.sha1(b"blob %d\0" % len(data) + data).hexdigest()


def file_matches(data: bytes, want: str) -> bool:
    if git_blob_id(data) == want:
        return True
    return b"\r\n" in data and git_blob_id(data.replace(b"\r\n", b"\n")) == want


def list_files(d: Path) -> dict:
    """Relative POSIX path -> Path for every regular file under d (follows dir links)."""
    out = {}
    for dirpath, dirnames, filenames in os.walk(d, followlinks=True):
        for fn in filenames:
            if fn in IGNORED_NAMES:
                continue
            p = Path(dirpath) / fn
            out[p.relative_to(d).as_posix()] = p
    return out


def verify_official(name: str, files_manifest: dict) -> list:
    """Errors for one installed official skill against its upstream blob manifest."""
    d = AGENTS_DIR / name
    if not d.is_dir():
        return [f"{name}: not installed (.agents/skills/{name} missing) - run python3 scripts/bootstrap-skills.py"]
    errs = []
    have = list_files(d)
    for rel in sorted(set(files_manifest) - set(have)):
        errs.append(f"{name}: missing upstream file {rel}")
    for rel in sorted(set(have) - set(files_manifest)):
        errs.append(f"{name}: unexpected file {rel} (not in upstream revision)")
    for rel in sorted(set(have) & set(files_manifest)):
        if not file_matches(have[rel].read_bytes(), files_manifest[rel]):
            errs.append(f"{name}: {rel} differs from upstream blob {files_manifest[rel][:12]} (modified?)")
    return errs


def front_matter(p: Path) -> dict:
    text = p.read_text(encoding="utf-8").replace("\r\n", "\n")
    if not text.startswith("---\n") or "\n---" not in text[4:]:
        return {}
    block = text[4:text.index("\n---", 4)]
    out = {}
    for line in block.splitlines():
        if line and not line.startswith((" ", "\t", "-")) and ":" in line:
            k, v = line.split(":", 1)
            out[k.strip()] = v.strip().strip('"')
    return out


def link_kind(p: Path) -> str:
    if p.is_symlink():
        return "symlink"
    if os.name == "nt" and p.is_dir():
        try:
            if os.readlink(p):  # Python 3.8+: junctions are readable on Windows
                return "junction"
        except (OSError, ValueError):
            pass
    if p.is_dir():
        return "copy"
    if p.exists():
        return "file"
    return "missing"


def verify_claude_entry(name: str) -> list:
    """The .claude/skills entry must expose the canonical, readable SKILL.md."""
    link = CLAUDE_DIR / name
    canon = AGENTS_DIR / name
    kind = link_kind(link)
    if kind == "missing":
        return [f"{name}: .claude/skills/{name} missing - run python3 scripts/bootstrap-skills.py"]
    if kind == "file":
        head = link.read_bytes()[:200]
        hint = " (looks like a symlink checked out as a text placeholder; core.symlinks=false)" \
            if b"\n" not in head.strip() and b".agents" in head else ""
        return [f"{name}: .claude/skills/{name} is a regular file, not a skill directory{hint}"]
    skill = link / "SKILL.md"
    try:
        fm = front_matter(skill)
    except (OSError, UnicodeDecodeError) as e:
        return [f"{name}: .claude/skills/{name}/SKILL.md not readable ({e.__class__.__name__})"]
    if fm.get("name") != name:
        return [f"{name}: .claude/skills/{name}/SKILL.md declares name {fm.get('name')!r} (wrong target)"]
    if kind in ("symlink", "junction"):
        try:
            same = link.resolve(strict=True) == canon.resolve(strict=True)
        except OSError:
            same = False
        if not same:
            return [f"{name}: .claude/skills/{name} points to {os.readlink(link)!r}, not .agents/skills/{name}"]
        return []
    # copy fallback: must be content-identical to the canonical folder
    a, b = list_files(link), list_files(canon)
    if set(a) != set(b) or any(a[r].read_bytes() != b[r].read_bytes() for r in a):
        return [f"{name}: .claude/skills/{name} is a copy that differs from .agents/skills/{name}"]
    return []


def make_dir_link(link: Path, target: Path) -> str:
    """Create link -> target. Order: relative symlink, Windows junction, copy. Returns kind."""
    if link.is_symlink() or link.is_file():
        link.unlink()
    elif link.is_dir():
        if link_kind(link) == "junction":
            os.rmdir(link)
        else:
            shutil.rmtree(link)
    link.parent.mkdir(parents=True, exist_ok=True)
    try:
        if os.environ.get("SMF_FORCE_JUNCTION") == "1" and os.name == "nt":
            raise OSError("symlink skipped to exercise the junction fallback")
        os.symlink(os.path.relpath(target, link.parent), link, target_is_directory=True)
        return "symlink"
    except (OSError, NotImplementedError):
        pass
    if os.name == "nt":
        r = subprocess.run(["cmd", "/c", "mklink", "/J", str(link), str(target)], capture_output=True)
        if r.returncode == 0:
            return "junction"
    shutil.copytree(target, link)
    return "copy"


def remove_entry(p: Path) -> None:
    """Remove a generated .claude/skills entry of any kind (symlink, junction, copy, file)."""
    kind = link_kind(p)
    if kind in ("symlink", "file"):
        p.unlink()
    elif kind == "junction":
        os.rmdir(p)
    elif kind == "copy":
        shutil.rmtree(p)
