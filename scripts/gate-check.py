#!/usr/bin/env python3
"""SMF-15 GATE-01: check every capability-matrix row against its evidence and reject unsupported claims.

Reads testing/matrix.json (kept in sync by scripts/build-matrix.py), testing/contract.json and
testing/test-plan-index.json, plus each linked evidence record. No network and no org access.

A row's outcome is *rejected* when its evidence cannot support it:
  E1  the outcome is PASS/FAIL/PARTIAL, but no evidence record exists or the record is missing a
      required SMF-3 evidence field (persona pair, build, host, timestamp, tester)
  E2  a required host row (desktop Chrome/Edge, physical Salesforce mobile) is backed by
      localhost, emulation, a mock or a simulation, or desktop Chrome is backed by Playwright
      Chromium
  E3  a physical Salesforce mobile row has no record of a physical device or the Salesforce app
  E4  the row needs a human (matrix executor "human") but only the agent is named as tester
  E5  the record claims an admin session in place of the specified persona

A story is VALIDATED only when every required row has an executed outcome (PASS, FAIL or
PARTIAL) and nothing was rejected. Otherwise it is INCOMPLETE, and the BLOCKED and NOT TESTED
rows are listed. Reduced scope needs a recorded owner decision; this script never assumes one.

  python3 scripts/gate-check.py                 # print the summary; exit 1 if any claim is rejected
  python3 scripts/gate-check.py --write         # also write testing/gate/GATE-01-report.{md,json}
"""
import argparse, importlib.util, json, re, sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("build_matrix", ROOT / "scripts" / "build-matrix.py")
BM = importlib.util.module_from_spec(spec)
spec.loader.exec_module(BM)

EXECUTED = {"PASS", "FAIL", "PARTIAL"}
NOT_DEVICE = re.compile(r"localhost|emulat|\bmock|simulat|stub|fake (camera|media|device)", re.I)
HUMAN = re.compile(r"brandon|designated|device tester|human|tester \(", re.I)
FIELDS = ["Persona pair", "Build / commit", "Host / device / OS / app / browser", "Timestamp", "Tester"]


def first_record(ev: str):
    for link in BM.links(ev or ""):
        p = ROOT / link
        if p.suffix == ".md" and p.exists():
            return link, BM.parse_record(p)
    return None, None


def check_row(r: dict, required: set) -> list:
    out, env = [], r["environment"]
    if r["outcome"] not in EXECUTED:
        return out
    link, rec = first_record(r.get("evidence", ""))
    if rec is None:
        return [f"E1 no evidence record for an executed outcome ({r.get('evidence') or 'none'})"]
    missing = [f for f in FIELDS if not rec.get(f) or rec[f].startswith("<")]
    if missing:
        out.append(f"E1 {link} lacks {', '.join(missing)}")
    host = rec.get("Host / device / OS / app / browser", "")
    if env in required and env != "n/a":
        if NOT_DEVICE.search(host):
            out.append(f"E2 required row {env} backed by a non-host run: {host[:80]}")
        if env == "ENV-DESKTOP-CHROME" and re.search(r"chromium", host, re.I) and not re.search(r"google chrome", host, re.I):
            out.append("E2 ENV-DESKTOP-CHROME backed by Chromium, not Google Chrome")
        if env.startswith("ENV-SFMOBILE") and not re.search(r"salesforce (mobile )?app", host, re.I):
            out.append(f"E3 {env} record names no physical device in the Salesforce app")
    if str(r.get("executor", "")).startswith("human") and not HUMAN.search(rec.get("Tester", "")):
        out.append("E4 human-executed row has only an agent as tester")
    if re.search(r"admin session|as MF-ADMIN instead", rec.get("Persona pair", "") + rec.get("Steps", ""), re.I):
        out.append("E5 admin session used in place of the specified persona")
    return out


def evaluate():
    matrix = BM.load(ROOT / "testing" / "matrix.json")
    contract = BM.load(ROOT / "testing" / "contract.json")
    index = BM.load(ROOT / "testing" / "test-plan-index.json")
    required = {e["id"] for e in contract["environments"]["rows"] if e.get("required")} | {"n/a"}
    stories = defaultdict(lambda: {"required": Counter(), "supplementary": Counter(), "open": [], "rejected": []})
    for r in matrix["rows"]:
        s = stories[r["story"]]
        req = r["environment"] in required
        s["required" if req else "supplementary"][r["outcome"]] += 1
        for e in check_row(r, required):
            s["rejected"].append({"row": r["row_id"], "outcome": r["outcome"], "reason": e})
        if req and r["outcome"] not in EXECUTED:
            s["open"].append({"row": r["row_id"], "outcome": r["outcome"]})
    order = [x["key"] for x in index["stories"]]
    result = []
    for key in order:
        if key not in stories:
            continue
        s = stories[key]
        verdict = "VALIDATED" if not s["open"] and not s["rejected"] else "INCOMPLETE"
        result.append({"story": key, "verdict": verdict, "required": dict(s["required"]),
                       "supplementary": dict(s["supplementary"]), "open_required_rows": s["open"],
                       "rejected": s["rejected"]})
    return result


def render(result) -> str:
    vals = ["PASS", "FAIL", "PARTIAL", "BLOCKED", "NOT TESTED"]
    lines = ["# GATE-01 — matrix rows checked against evidence",
             "",
             "Generated by `python3 scripts/gate-check.py --write` from `testing/matrix.json`.",
             "Do not edit by hand. Required rows are desktop Chrome/Edge, physical Salesforce mobile",
             "iOS/Android, and org-level (`n/a`) rows. Supplementary rows (cloud Chromium, mobile",
             "browsers, localhost) never satisfy a required row.",
             "",
             "| Story | Verdict | Required: " + " / ".join(vals) + " | Supplementary executed | Rejected claims |",
             "|---|---|---|---|---|"]
    for s in result:
        req = " / ".join(str(s["required"].get(v, 0)) for v in vals)
        sup = sum(s["supplementary"].get(v, 0) for v in EXECUTED)
        lines.append(f"| {s['story']} | **{s['verdict']}** | {req} | {sup} | {len(s['rejected'])} |")
    rej = [(s["story"], x) for s in result for x in s["rejected"]]
    lines += ["", "## Rejected claims", ""]
    lines += [f"- {k} `{x['row']}` ({x['outcome']}): {x['reason']}" for k, x in rej] or ["None."]
    lines += ["", "## Open required rows (BLOCKED / NOT TESTED)", ""]
    for s in result:
        if s["open_required_rows"]:
            c = Counter(x["outcome"] for x in s["open_required_rows"])
            rows = ", ".join(f"`{x['row']}`" for x in s["open_required_rows"])
            lines.append(f"- **{s['story']}** ({', '.join(f'{v} {n}' for v, n in c.items())}): {rows}")
    return "\n".join(lines) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--write", action="store_true", help="write testing/gate/GATE-01-report.md and .json")
    a = ap.parse_args()
    result = evaluate()
    if a.write:
        d = ROOT / "testing" / "gate"
        d.mkdir(exist_ok=True)
        (d / "GATE-01-report.md").write_text(render(result), encoding="utf-8", newline="\n")
        (d / "GATE-01-report.json").write_text(json.dumps(result, indent=1) + "\n", encoding="utf-8", newline="\n")
    nval = sum(s["verdict"] == "VALIDATED" for s in result)
    nrej = sum(len(s["rejected"]) for s in result)
    nopen = sum(len(s["open_required_rows"]) for s in result)
    print(f"{'FAIL' if nrej else 'OK'}: {len(result)} stories; {nval} VALIDATED, {len(result) - nval} INCOMPLETE; "
          f"{nopen} required rows BLOCKED/NOT TESTED; {nrej} rejected claims")
    for s in result:
        for x in s["rejected"]:
            print(f"  REJECTED {x['row']} ({x['outcome']}): {x['reason']}")
    return 1 if nrej else 0


if __name__ == "__main__":
    sys.exit(main())
