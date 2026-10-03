#!/usr/bin/env python3
"""SMF-5: switch the repository between package v1 and v2 definitions (offline).

  python3 scripts/smf5/set_version.py v2

Changes exactly two things, which together are the whole v1 -> v2 difference:
  - force-app/.../src/probes/smf-05-version/packageVersion.ts PACKAGE_MARKER
  - sfdx-project.json versionNumber / versionName / versionDescription of FieldSupportPoC
Commit the result before building the version so the version maps to a commit.
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MARKER = ROOT / "force-app/main/default/uiBundles/FieldSupport/src/probes/smf-05-version/packageVersion.ts"
VERSIONS = {
    "v1": ("1.0.0", "v1 launch baseline",
           "SMF-5 PKG-01: FieldSupport UI bundle, its CustomApplication and the FieldSupport_Access permission set."),
    "v2": ("1.1.0", "v2 upgrade marker",
           "SMF-5 PKG-02: identical to v1 except the Package version marker page shows v2 (1.1.0)."),
}
RX = re.compile(r"(PACKAGE_MARKER\s*:\s*PackageMarker\s*=\s*)\{[^}]*\}")


def apply(label: str, marker_text: str, project: dict):
    number, name, desc = VERSIONS[label]
    new_text, n = RX.subn(lambda m: f"{m.group(1)}{{ label: '{label}', number: '{number}' }}", marker_text)
    if n != 1:
        raise ValueError("PACKAGE_MARKER declaration not found exactly once")
    d = next(x for x in project["packageDirectories"] if x.get("package") == "FieldSupportPoC")
    d.update(versionNumber=f"{number}.NEXT", versionName=name, versionDescription=desc)
    return new_text, project


def main() -> int:
    if len(sys.argv) != 2 or sys.argv[1] not in VERSIONS:
        sys.exit(f"usage: {Path(sys.argv[0]).name} {'|'.join(VERSIONS)}")
    pj = ROOT / "sfdx-project.json"
    text, project = apply(sys.argv[1], MARKER.read_text(encoding="utf-8"), json.loads(pj.read_text(encoding="utf-8")))
    MARKER.write_text(text, encoding="utf-8", newline="\n")
    pj.write_text(json.dumps(project, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    print(f"set {sys.argv[1]}: versionNumber {project['packageDirectories'][0]['versionNumber']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
