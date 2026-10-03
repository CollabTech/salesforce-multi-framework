#!/usr/bin/env python3
"""Capability matrix (SMF-3 AC4 / DATA-04): validate testing/matrix.json and render testing/MATRIX.md.

  python3 scripts/build-matrix.py           # validate, then (re)write testing/MATRIX.md
  python3 scripts/build-matrix.py --check   # validate and fail if MATRIX.md is stale (no writes)
  python3 scripts/build-matrix.py --sync    # add missing rows (NOT TESTED) and copy results from
                                            # evidence records into their rows, then validate+render

Rows are one per case ID x applicable environment row (x capability area where a case records
areas separately, e.g. CAP camera/mic). Applicability is the APPLICABILITY table below (SMF-3
initialisation decision, recorded in matrix.json and testing/MATRIX.md). Validation:
- every case ID in testing/test-plan-index.json has at least one row; rows name known cases,
  their owning story, and an environment row from testing/contract.json (or "n/a");
- each row carries every contract matrix row_field and a defined outcome;
- a row that is not NOT TESTED has a tester, a date and an evidence link that exists; when
  the link is an evidence record for the same case, the record's outcome must match;
- every case evidence record under evidence/ is linked from at least one row.
--sync only fills rows from evidence records whose file name is the conventional
evidence/SMF-n/<CASE>.md (environment "n/a") or <CASE>-<ENV-ROW>.md; it never invents results.
"""
import argparse, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MATRIX = ROOT / "testing" / "matrix.json"
MD = ROOT / "testing" / "MATRIX.md"

HOSTS = ["ENV-DESKTOP-CHROME", "ENV-DESKTOP-EDGE", "ENV-SFMOBILE-IOS", "ENV-SFMOBILE-ANDROID",
         "ENV-MOBILE-SAFARI", "ENV-MOBILE-CHROME", "ENV-CLOUD-CHROMIUM", "ENV-EMULATION-LOCALHOST"]
MOBILE = ["ENV-SFMOBILE-IOS", "ENV-SFMOBILE-ANDROID", "ENV-MOBILE-SAFARI", "ENV-MOBILE-CHROME",
          "ENV-EMULATION-LOCALHOST"]
DATA02 = ["n/a"] + HOSTS[:7]
# Who executes a row (cloud-first workflow, docs/cloud/WORKFLOW.md). Human-only parts of an agent row
# (observed audio/video, OS permission prompts, interactive password/MFA login) stay with a person.
EXECUTOR = {
    "n/a": "agent (repository checks now; org checks in the cloud after HUMAN-SETUP H1/H2)",
    "ENV-DESKTOP-EDGE": "agent: cloud automation in official Microsoft Edge after H1/H2; human for steps automation cannot attest",
    "ENV-DESKTOP-CHROME": "agent: cloud automation in branded Chrome once H1 allows dl.google.com; human for steps automation cannot attest",
    "ENV-CLOUD-CHROMIUM": "agent: cloud automation (Playwright Chromium; separate row, never a substitute)",
    "ENV-EMULATION-LOCALHOST": "agent: emulation/localhost (separate row, never a substitute)",
    "ENV-SFMOBILE-IOS": "human: device tester on a physical iPhone/iPad (testing/HUMAN-ACTIONS.md)",
    "ENV-SFMOBILE-ANDROID": "human: device tester on a physical Android device (testing/HUMAN-ACTIONS.md)",
    "ENV-MOBILE-SAFARI": "human: device tester, mobile Safari (exploratory)",
    "ENV-MOBILE-CHROME": "human: device tester, mobile Chrome (exploratory)",
}

# (case-ID prefix or exact ID, environment rows, rationale). First match wins.
APPLICABILITY = [
    ("GOV-", ["n/a"], "Repository/agent checks; no Salesforce host."),
    ("ENV-", ["n/a"], "Org/CLI readiness; no end-user host."),
    ("DATA-02", DATA02, "n/a = org-level automated access checks (UserRecordAccess baseline + Apex System.runAs); "
                        "desktop rows = cloud browser run as each persona (stage 51) plus the human interactive-login "
                        "script; mobile rows = human scripts in docs/test-scripts/ (SMF-3 DATA-04)."),
    ("DATA-", ["n/a"], "Org data/baseline/repository deliverables; no end-user host."),
    ("PKG-", ["n/a"], "Package operations in the install-test org; host coverage of the launched app is HOST-03."),
    ("REC-", MOBILE, "SMF-9 tests MF-TECH on a mobile device (MF-SUPPORT on desktop, recorded in the row's context)."),
    ("GATE-", ["n/a"], "Decision review of the matrix; no host."),
    ("BUDGET-04", ["n/a"], "Publishes the tested budget from BUDGET-01..03; no new host run."),
    ("E2E-04", ["n/a"], "Publishes the curated demo and matrix; no new host run."),
    ("", HOSTS, "User-facing capability: required desktop Chrome/Edge and physical Salesforce mobile iOS/Android, "
                "exploratory mobile Safari/Chrome, and cloud Chromium and emulation/localhost as separate evidence "
                "(SMF-3 AC3; cloud-first workflow)."),
]
# Cases whose story requires camera and mic to be recorded separately (SMF-6 CAP-03).
SPLIT_AREAS = {"CAP-01": ["camera", "mic"], "CAP-02": ["camera", "mic"], "CAP-03": ["camera", "mic"]}


def load(p):
    return json.loads(p.read_text(encoding="utf-8"))


def applicable(case_id):
    for prefix, envs, why in APPLICABILITY:
        if case_id.startswith(prefix):
            return envs, why
    raise AssertionError(case_id)


def areas_for(case_id, contract):
    m = contract["outcomes"]["capability_area_cases"]
    areas = [a for a in contract["outcomes"]["capability_areas"] if case_id in m.get(a, [])]
    if not areas:
        sup = contract["outcomes"]["supporting_areas"]
        areas = [k for k, v in sup.items() if k != "note" and case_id in v]
    return areas


def row_id(case, env, area=None):
    return f"{case}@{env}" + (f"#{area}" if area else "")


def env_context(env, contract):
    if env == "n/a":
        return "n/a — no end-user host (repository, org or decision check)"
    r = next(x for x in contract["environments"]["rows"] if x["id"] == env)
    status = "required" if r.get("required") else ("exploratory" if r.get("exploratory") else "separate evidence; never a substitute")
    return f"{r['kind']} ({status}); record: {', '.join(r.get('record', [])) or 'runtime origin/hosting context'}"


def actor_pair(story, case):
    refs = case["persona_refs"] or story["persona_refs"]
    return " + ".join(refs) if refs else "n/a — no Salesforce persona (implementing agent / reviewer)"


def blank_row(story, case, env, area, contract):
    fields = contract["matrix"]["row_fields"]
    r = {"row_id": row_id(case["id"], env, area), "case": case["id"], "story": story["key"], "environment": env,
         "capability_areas": [area] if area else areas_for(case["id"], contract)}
    r.update({f: "" for f in fields})
    r["capability"] = (area if area else "; ".join(r["capability_areas"])) or "n/a"
    r["actor pair"] = actor_pair(story, case)
    r["context"] = env_context(env, contract)
    r["expectation"] = case["spec"]
    r["outcome"] = "NOT TESTED"
    r["executor"] = EXECUTOR[env]
    if case["id"] == "DATA-02" and env in ("ENV-DESKTOP-EDGE", "ENV-DESKTOP-CHROME", "ENV-CLOUD-CHROMIUM"):
        r["steps"] = ("automated: scripts/cloud/stages/51-smf3-cloud-access.sh (testing/cloud-e2e/tests/smf-3-access.spec.ts)"
                      + ("" if env == "ENV-CLOUD-CHROMIUM" else f"; interactive login: docs/test-scripts/{env}.md"))
    elif case["id"] == "DATA-02" and env != "n/a":
        r["steps"] = f"docs/test-scripts/{env}.md"
    elif case["id"] == "DATA-02":
        r["steps"] = ("scripts/cloud/stages/33-smf3-baseline.sh (UserRecordAccess) and "
                      "34-smf3-apex-access.sh (MF_AccessBaselineTest, System.runAs)")
    return r


def parse_record(path):
    out = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.startswith("| ") or line.startswith("| Field") or line.startswith("|---"):
            continue
        cells = [c.strip().replace("\\|", "|") for c in re.split(r"(?<!\\)\|", line)[1:-1]]
        if len(cells) == 2:
            out[cells[0]] = cells[1]
    return out


def fill_from_record(r, rel, rec):
    r["outcome"] = rec.get("Outcome", r["outcome"])
    r["evidence"] = rel
    r["org/build reference"] = rec.get("Build / commit", "")
    r["device/OS/app/browser versions"] = rec.get("Host / device / OS / app / browser", "")
    r["steps"] = rec.get("Steps", "")
    r["observation"] = rec.get("Actual result", "")
    r["tester"] = rec.get("Tester", "")
    ts = rec.get("Timestamp", "")
    m = re.search(r"\d{4}-\d{2}-\d{2}", ts)
    r["date"] = m.group(0) if m else ts
    r["limitation"] = rec.get("Limitation / follow-up", "")


def record_path(story, case, env):
    name = f"{case}.md" if env == "n/a" else f"{case}-{env}.md"
    return f"evidence/{story}/{name}"


def sync(matrix, index, contract):
    by_id = {r["row_id"]: r for r in matrix["rows"]}
    rows = []
    for s in index["stories"]:
        for c in s["cases"]:
            envs, _ = applicable(c["id"])
            for env in envs:
                for area in SPLIT_AREAS.get(c["id"], [None]):
                    rid = row_id(c["id"], env, area)
                    r = by_id.get(rid) or blank_row(s, c, env, area, contract)
                    r.setdefault("executor", EXECUTOR[env])
                    rel = record_path(s["key"], c["id"], env)
                    if not (ROOT / rel).exists() and env != "n/a":
                        # a single record may cover several rows: its "Environment row" lists them
                        base = record_path(s["key"], c["id"], "n/a")
                        if (ROOT / base).exists() and env in parse_record(ROOT / base).get("Environment row", ""):
                            rel = base
                    if (ROOT / rel).exists():
                        cur = re.search(r"Current result:\s*>?\s*`([^`]+)`", (ROOT / rel).read_text(encoding="utf-8"))
                        if cur:  # historical record superseded by a newer run (never overwritten)
                            newer = f"evidence/{s['key']}/{cur.group(1)}"
                            fill_from_record(r, newer, parse_record(ROOT / newer))
                            r["evidence"] = f"{newer}; {rel} (historical)"
                        else:
                            fill_from_record(r, rel, parse_record(ROOT / rel))
                    rows.append(r)
    extra = [r for r in matrix["rows"] if r["row_id"] not in {x["row_id"] for x in rows}]
    matrix["rows"] = rows + extra   # unknown rows are kept so validation reports them
    matrix["applicability"] = [{"cases": p or "(all other cases)", "environments": e, "rationale": w}
                               for p, e, w in APPLICABILITY]
    matrix["split_capability_areas"] = SPLIT_AREAS
    return matrix


def links(ev):
    return [x.split("#")[0] for x in re.split(r"[;,\s]+", ev) if x and ("/" in x or x.endswith(".md"))]


def validate(matrix, index, contract):
    errs = []
    owners = {c["id"]: s["key"] for s in index["stories"] for c in s["cases"]}
    env_ids = {r["id"] for r in contract["environments"]["rows"]} | {"n/a"}
    outcomes = set(contract["outcomes"]["values"])
    fields = contract["matrix"]["row_fields"]
    seen, covered, linked = set(), set(), set()
    for r in matrix["rows"]:
        rid = r.get("row_id", "?")
        if rid in seen:
            errs.append(f"duplicate row_id {rid}")
        seen.add(rid)
        case = r.get("case")
        if case not in owners:
            errs.append(f"{rid}: unknown case {case}")
            continue
        covered.add(case)
        if r.get("story") != owners[case]:
            errs.append(f"{rid}: story {r.get('story')} but {case} belongs to {owners[case]}")
        if r.get("environment") not in env_ids:
            errs.append(f"{rid}: unknown environment {r.get('environment')}")
        for f in fields:
            if f not in r:
                errs.append(f"{rid}: missing field '{f}'")
        o = r.get("outcome")
        if o not in outcomes:
            errs.append(f"{rid}: invalid outcome {o!r}")
            continue
        if o != "NOT TESTED":
            ls = links(r.get("evidence", ""))
            if not ls:
                errs.append(f"{rid}: outcome {o} without an evidence link")
            for l in ls:
                p = ROOT / l
                if not p.exists():
                    errs.append(f"{rid}: evidence link does not exist: {l}")
                    continue
                linked.add(l)
                rec = parse_record(p) if p.suffix == ".md" else {}
                if rec.get("Case ID") == case and rec.get("Outcome") != o:
                    errs.append(f"{rid}: outcome {o} but {l} records {rec.get('Outcome')}")
            if not r.get("tester") or not r.get("date"):
                errs.append(f"{rid}: outcome {o} needs tester and date")
    missing = sorted(set(owners) - covered, key=lambda c: (owners[c], c))
    if missing:
        errs.append(f"case IDs without a matrix row: {missing}")
    for ev in sorted((ROOT / "evidence").rglob("*.md")):
        rel = ev.relative_to(ROOT).as_posix()
        if ev.name in ("README.md", "TEMPLATE.md"):
            continue
        rec = parse_record(ev)
        if rec.get("Case ID") in owners and rel not in linked:
            errs.append(f"{rel} ({rec.get('Outcome')}) is not linked from any matrix row")
    return errs


def render(matrix, index, contract):
    rows = matrix["rows"]
    counts = {o: sum(r["outcome"] == o for r in rows) for o in contract["outcomes"]["values"]}
    L = ["# Capability matrix", "",
         "<!-- Generated by scripts/build-matrix.py from testing/matrix.json. Do not edit by hand. -->", "",
         f"Initialised by SMF-3 (DATA-04). {len(rows)} rows across {index['case_count']} case IDs. "
         "Outcome definitions and capability areas: [`contract.json`](contract.json) → `outcomes`. "
         "Full row fields (" + ", ".join(contract["matrix"]["row_fields"]) + ") are in "
         "[`matrix.json`](matrix.json).", "",
         "| Outcome | Rows |", "|---|---|"] + [f"| {o} | {n} |" for o, n in counts.items()]
    L += ["", "## Environment applicability (SMF-3 initialisation decision)", "",
          "| Cases | Environment rows | Rationale |", "|---|---|---|"]
    for a in matrix["applicability"]:
        L.append(f"| {a['cases']} | {', '.join(a['environments'])} | {a['rationale']} |")
    L.append("")
    L.append("CAP-01..03 have separate camera and mic rows (SMF-6 CAP-03). `n/a` = no end-user host. "
             "Emulation/localhost rows are separate evidence and never substitute for another row.")
    for s in index["stories"]:
        srows = [r for r in rows if r["story"] == s["key"]]
        L += ["", f"## {s['key']} {s['summary']}", "",
              "| Row | Capability | Environment | Actor pair | Executor | Outcome | Evidence | Tester | Date |",
              "|---|---|---|---|---|---|---|---|---|"]
        for r in srows:
            ev = " ".join(f"[{l}](../{l})" for l in links(r["evidence"])) or "—"
            cell = lambda v: (v or "—").replace("|", "\\|")
            L.append(f"| {r['case']} | {cell(r['capability'])} | {r['environment']} | {cell(r['actor pair'])} | "
                     f"{cell(r.get('executor', '').split(':')[0].split(' (')[0])} | "
                     f"**{r['outcome']}** | {ev} | {cell(r['tester'])} | {cell(r['date'])} |")
    return "\n".join(L) + "\n"


def main():
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--check", action="store_true")
    g.add_argument("--sync", action="store_true")
    a = ap.parse_args()
    index = load(ROOT / "testing" / "test-plan-index.json")
    contract = load(ROOT / "testing" / "contract.json")
    if MATRIX.exists():
        matrix = load(MATRIX)
    elif a.sync:
        matrix = {"rows": []}
    else:
        print("FAIL: testing/matrix.json missing (run with --sync to initialise)")
        return 1
    if a.sync:
        matrix = {"matrix_version": "1.0.0", "initialised_by": "SMF-3",
                  "note": ("One row per case ID x applicable environment row (x capability area where recorded "
                           "separately). Every row starts NOT TESTED; a row changes only with a linked, executed "
                           "evidence record. Fields: testing/contract.json matrix.row_fields."),
                  **{k: v for k, v in matrix.items() if k not in ("matrix_version", "initialised_by", "note")}}
        matrix = sync(matrix, index, contract)
        MATRIX.write_text(json.dumps(matrix, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    errs = validate(matrix, index, contract)
    if errs:
        print("FAIL")
        print("\n".join(" - " + e for e in errs))
        return 1
    md = render(matrix, index, contract)
    if a.check:
        if not MD.exists() or MD.read_text(encoding="utf-8") != md:
            print("FAIL: testing/MATRIX.md is stale; run python3 scripts/build-matrix.py")
            return 1
    else:
        MD.write_text(md, encoding="utf-8", newline="\n")
    n = {o: sum(r["outcome"] == o for r in matrix["rows"]) for o in contract["outcomes"]["values"]}
    print(f"OK: {len(matrix['rows'])} matrix rows cover all {index['case_count']} case IDs; "
          + ", ".join(f"{k} {v}" for k, v in n.items()) + "; evidence links resolve")
    return 0


if __name__ == "__main__":
    sys.exit(main())
