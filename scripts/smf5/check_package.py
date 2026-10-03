#!/usr/bin/env python3
"""SMF-5 offline packaging check (no org access).

Verifies, before any `sf package version create`:
  1. sfdx-project.json declares exactly one packaged directory (`force-app`, package
     FieldSupportPoC, versionNumber X.Y.Z.NEXT, no namespace, no ancestor keys — ancestors
     are a managed-2GP concept) and no committed package IDs in packageAliases;
  2. the packaged directory contains exactly the intended metadata (UI bundle, its
     CustomApplication, FieldSupport_Access) — test fixtures belong in `unpackaged/`;
  3. the CustomApplication / permission set carry the fields the 2GP skill requires;
  4. the bundle's PACKAGE_MARKER number equals versionNumber's major.minor.patch;
  5. with --built: the converted package payload contains the built dist/ and no
     node_modules (a package built before `npm run build` installs but renders blank).

Usage: python3 scripts/smf5/check_package.py [--built] [--sf <path to sf>]
Output contains no org, user, record or package IDs.
"""
import argparse, json, os, re, shutil, subprocess, sys, tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PKG_DIR = "force-app"
PKG_NAME = "FieldSupportPoC"
BUNDLE = "FieldSupport"
EXPECTED = {("CustomApplication", "FieldSupport"), ("PermissionSet", "FieldSupport_Access"), ("UIBundle", BUNDLE)}
NS = {"m": "http://soap.sforce.com/2006/04/metadata"}
ID_RX = re.compile(r"^(?:0Ho|04t|05i|08c|0Hf|06y)[A-Za-z0-9]{12}(?:[A-Za-z0-9]{3})?$")
MARKER_RX = re.compile(r"PACKAGE_MARKER\s*:\s*PackageMarker\s*=\s*\{\s*label:\s*'(v\d+)'\s*,\s*number:\s*'(\d+\.\d+\.\d+)'\s*\}")
MARKER_FILE = f"{PKG_DIR}/main/default/uiBundles/{BUNDLE}/src/probes/smf-05-version/packageVersion.ts"


def check_project(project: dict) -> list:
    errs = []
    dirs = project.get("packageDirectories", [])
    packaged = [d for d in dirs if "package" in d]
    if len(packaged) != 1 or packaged[0].get("path") != PKG_DIR or packaged[0].get("package") != PKG_NAME:
        errs.append(f"expected exactly one packaged directory '{PKG_DIR}' with package '{PKG_NAME}'")
        return errs
    d = packaged[0]
    if not re.fullmatch(r"\d+\.\d+\.\d+\.NEXT", d.get("versionNumber", "")):
        errs.append("versionNumber must be X.Y.Z.NEXT")
    if not d.get("versionName"):
        errs.append("versionName is required")
    for k in ("ancestorId", "ancestorVersion"):
        if k in d:
            errs.append(f"{k} is a managed-2GP setting; remove it for an unlocked package")
    if project.get("namespace", "") != "":
        errs.append("namespace must be '' (unlocked, org-dependent, no namespace)")
    if not any(x.get("default") for x in dirs if x.get("path") == PKG_DIR):
        errs.append(f"'{PKG_DIR}' must stay the default package directory")
    for alias, value in (project.get("packageAliases") or {}).items():
        if isinstance(value, str) and ID_RX.match(value):
            errs.append(f"packageAliases['{alias}'] holds a package/version ID: keep IDs in private/packages.json, "
                        "then `git checkout -- sfdx-project.json`")
    return errs


def parse_manifest(xml_text: str) -> set:
    root = ET.fromstring(xml_text)
    out = set()
    for t in root.findall("m:types", NS):
        name = t.find("m:name", NS).text
        for m in t.findall("m:members", NS):
            out.add((name, m.text))
    return out


def check_members(members: set) -> list:
    errs = []
    extra, missing = sorted(members - EXPECTED), sorted(EXPECTED - members)
    if extra:
        errs.append("not intended for the package (move test fixtures to unpackaged/, or record a packaging "
                    "decision in docs/smf-5/subscriber-runbook.md): " + ", ".join(f"{a}:{b}" for a, b in extra))
    if missing:
        errs.append("missing from the package: " + ", ".join(f"{a}:{b}" for a, b in missing))
    return errs


def check_app_and_permset(root: Path) -> list:
    errs = []
    base = root / PKG_DIR / "main" / "default"
    app = ET.parse(base / "applications" / "FieldSupport.app-meta.xml").getroot()
    vals = lambda tag: [e.text for e in app.findall(f"m:{tag}", NS)]  # noqa: E731
    if vals("uiType") != ["Lightning"]:
        errs.append("CustomApplication uiType must be Lightning")
    if vals("navType") != ["Standard"]:
        errs.append("CustomApplication navType must be Standard")
    if "Large" not in vals("formFactors"):
        errs.append("CustomApplication formFactors must include Large (else the App Launcher tile is hidden)")
    if [v.split("__")[-1] for v in vals("uiBundle")] != [BUNDLE]:
        errs.append(f"CustomApplication uiBundle must reference {BUNDLE}")
    ps = ET.parse(base / "permissionsets" / "FieldSupport_Access.permissionset-meta.xml").getroot()
    vis = [(a.find("m:application", NS).text, a.find("m:visible", NS).text) for a in ps.findall("m:applicationVisibilities", NS)]
    if ("FieldSupport", "true") not in vis:
        errs.append("FieldSupport_Access must grant FieldSupport application visibility")
    return errs


def check_marker(project: dict, marker_text: str) -> list:
    m = MARKER_RX.search(marker_text)
    if not m:
        return [f"PACKAGE_MARKER not found in {MARKER_FILE}"]
    d = next(x for x in project["packageDirectories"] if x.get("package") == PKG_NAME)
    want = ".".join(d["versionNumber"].split(".")[:3])
    if m.group(2) != want:
        return [f"PACKAGE_MARKER number {m.group(2)} != sfdx-project.json versionNumber {want}"]
    return []


def sf_exe(explicit):
    exe = explicit or os.environ.get("SF_BIN") or shutil.which("sf") or shutil.which("sf.cmd")
    if not exe:
        sys.exit("sf CLI not found (set --sf or SF_BIN)")
    return exe


def run_sf(exe, args):
    env = dict(os.environ, SF_DISABLE_TELEMETRY="true")
    r = subprocess.run([exe, *args, "--json"], cwd=ROOT, capture_output=True, text=True, env=env)
    if r.returncode != 0:
        sys.exit(f"sf {' '.join(args[:3])} failed:\n{r.stdout[-2000:]}{r.stderr[-2000:]}")


def check_payload(mdapi_dir: Path) -> tuple:
    bundle = mdapi_dir / "uiBundles" / BUNDLE
    files = [p for p in bundle.rglob("*") if p.is_file()]
    rel = [p.relative_to(bundle).as_posix() for p in files]
    errs = []
    if "dist/index.html" not in rel:
        errs.append("built dist/index.html missing from the package payload: run `npm run build` in the bundle first")
    if any(r.startswith("node_modules/") or "/node_modules/" in r for r in rel):
        errs.append("node_modules found in the package payload")
    size = sum(p.stat().st_size for p in files)
    dist = sum(1 for r in rel if r.startswith("dist/"))
    return errs, f"payload: {len(files)} bundle files ({dist} in dist/), {size / 1024:.0f} KiB"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--built", action="store_true", help="also convert the package dir and inspect the payload")
    ap.add_argument("--sf", help="path to the sf executable")
    a = ap.parse_args()

    project = json.loads((ROOT / "sfdx-project.json").read_text(encoding="utf-8"))
    errs = check_project(project)
    exe = sf_exe(a.sf)
    with tempfile.TemporaryDirectory() as tmp:
        run_sf(exe, ["project", "generate", "manifest", "--source-dir", PKG_DIR, "--output-dir", tmp])
        members = parse_manifest((Path(tmp) / "package.xml").read_text(encoding="utf-8"))
    errs += check_members(members)
    errs += check_app_and_permset(ROOT)
    errs += check_marker(project, (ROOT / MARKER_FILE).read_text(encoding="utf-8"))
    print(f"package directory '{PKG_DIR}' members: " + ", ".join(f"{t}:{n}" for t, n in sorted(members)))
    if a.built:
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "mdapi"
            run_sf(exe, ["project", "convert", "source", "--source-dir", PKG_DIR, "--output-dir", str(out)])
            perrs, summary = check_payload(out)
            errs += perrs
            print(summary)
    if errs:
        print("FAIL")
        print("\n".join(f"- {e}" for e in errs))
        return 1
    print("OK: package definition and contents are as intended")
    return 0


if __name__ == "__main__":
    sys.exit(main())
