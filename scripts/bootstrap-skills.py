#!/usr/bin/env python3
"""Install the pinned official Salesforce skills on demand and expose all skills to agents.

Run once after cloning (Linux, macOS, Windows; needs Python 3.8+, Node/npx, network):

    python3 scripts/bootstrap-skills.py          # Windows: py -3 scripts\\bootstrap-skills.py

1. For each official skill in docs/provenance/official-skills.json that is missing or fails
   verification, install it with the upstream-documented mechanism
   (`npx skills@<pinned> add <upstream>/tree/<revision>/skills/<name> --agent codex -y`)
   into .agents/skills/<name> (project scope; never -g). Nothing vendor-owned is tracked.
2. Create .claude/skills/<name> for every skill (official and smf-*): a relative symlink,
   else a Windows directory junction (no admin/Developer Mode needed), else a copy.
   Text-file symlink placeholders (git core.symlinks=false) and wrong targets are replaced.
3. Run the same checks as scripts/verify-skills.py and exit non-zero on any failure.

Options:
  --offline           do not install; only (re)link and verify
  --record-manifest DIR  maintainer only: rewrite the per-file upstream blob manifest from a
                      git clone DIR of the upstream repo that contains the pinned revision
"""
import json, os, shutil, subprocess, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import smfskills as S  # noqa: E402


def npx() -> str:
    exe = shutil.which("npx") or shutil.which("npx.cmd")
    if not exe:
        sys.exit("FAIL: npx (Node.js) not found; install Node 18+ and rerun")
    return exe


def install(name: str, m: dict) -> None:
    target = S.AGENTS_DIR / name
    if target.is_symlink() or target.is_file():
        target.unlink()
    elif target.exists():
        shutil.rmtree(target)
    src = f"{m['upstream_repo']}/tree/{m['revision']}/skills/{name}"
    print(f"==> install {name} @ {m['revision'][:12]}")
    r = subprocess.run([npx(), "-y", m["installer_cli"], "add", src, "--agent", "codex", "-y"],
                       cwd=S.ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
    if r.returncode != 0:
        sys.exit(f"FAIL: installing {name}: {r.stderr.strip()[-500:]}")


def record_manifest(clone: Path) -> int:
    m = S.load_manifest()
    out = subprocess.run(["git", "-C", str(clone), "ls-tree", "-r", m["revision"], "skills"],
                         capture_output=True, text=True, check=True).stdout
    files = {}
    for line in out.splitlines():
        meta, path = line.split("\t", 1)
        _, kind, blob = meta.split()
        parts = path.split("/")
        if kind == "blob" and parts[1] in m["skills"]:
            files.setdefault(parts[1], {})["/".join(parts[2:])] = blob
    for n in m["skills"]:
        if n not in files:
            sys.exit(f"FAIL: {n} not found at {m['revision']}")
        m["skills"][n] = {"files": dict(sorted(files[n].items()))}
    S.PROV.write_text(json.dumps(m, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"recorded {sum(len(v) for v in files.values())} upstream blob IDs for {len(m['skills'])} skills")
    return 0


def main() -> int:
    if "--record-manifest" in sys.argv:
        return record_manifest(Path(sys.argv[sys.argv.index("--record-manifest") + 1]))
    m = S.load_manifest()
    S.AGENTS_DIR.mkdir(parents=True, exist_ok=True)
    if "--offline" not in sys.argv:
        lock_before = S.LOCK.read_bytes() if S.LOCK.exists() else None
        for name, entry in m["skills"].items():
            if S.verify_official(name, entry["files"]):
                install(name, m)
        if lock_before is not None:  # keep the committed pin record byte-stable
            S.LOCK.write_bytes(lock_before)
    names = sorted(p.name for p in S.AGENTS_DIR.iterdir() if p.is_dir())
    kinds = {}
    for n in names:
        if S.verify_claude_entry(n):
            kinds[n] = S.make_dir_link(S.CLAUDE_DIR / n, S.AGENTS_DIR / n)
    if kinds:
        print("linked:", ", ".join(f"{n} ({k})" for n, k in sorted(kinds.items())))
    return subprocess.call([sys.executable, str(S.ROOT / "scripts" / "verify-skills.py")])


if __name__ == "__main__":
    sys.exit(main())
