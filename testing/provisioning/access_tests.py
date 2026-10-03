#!/usr/bin/env python3
"""SMF-3 DATA-02 (org level): deploy and run MF_AccessBaselineTest, print a sanitized summary.

  python3 testing/provisioning/access_tests.py --target-org smf-dev [--report <sanitized.json>]

1. Verify org identity (the Dev Hub is refused unless --allow-devhub-as-dev).
2. `sf project deploy start --metadata-dir testing/provisioning/apex-tests --target-org <org>`
   (metadata-format deploy; no sfdx-project.json needed). On a production-type org the deploy
   runs the class itself (--test-level RunSpecifiedTests).
3. `sf apex run test --class-names MF_AccessBaselineTest --synchronous --target-org <org>`.
4. Summary: one line per test method (name, Pass/Fail, assertion message). Raw JSON (org IDs,
   usernames) stays in private/smf3/.
Exit: 0 all pass, 2 any failure, 1 error.
"""
import argparse, json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sfkit as K  # noqa: E402

CLASS = "MF_AccessBaselineTest"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--target-org", required=True)
    ap.add_argument("--allow-devhub-as-dev", action="store_true")
    ap.add_argument("--report")
    a = ap.parse_args()
    org = a.target_org
    ident, _ = K.verify_target(org, a.allow_devhub_as_dev)
    deploy = ["project", "deploy", "start", "--metadata-dir", str(K.PROV / "apex-tests"), "--wait", "30"]
    if not ident["is_scratch"] and not ident["sandbox"]:
        deploy += ["--test-level", "RunSpecifiedTests", "--tests", CLASS]
    out = K.sf(deploy, org, check=False)
    K.write_private(f"smf3/deploy-apex-tests-{K.now().replace(':', '')}.json", out)
    if out.get("status") != 0:
        raise K.SfError(f"deploy of {CLASS} failed: {K.redact(out.get('message', ''))}")
    K.say(f"[deploy] {CLASS} deployed")
    run = K.sf(["apex", "run", "test", "--class-names", CLASS, "--synchronous", "--result-format", "json"], org, check=False)
    K.write_private(f"smf3/apex-test-{K.now().replace(':', '')}.json", run)
    tests = (run.get("result") or {}).get("tests", [])
    rows = [{"method": t.get("MethodName"), "outcome": t.get("Outcome"),
             "message": K.redact(t.get("Message") or "")} for t in tests]
    for r in rows:
        K.say(f"[{r['outcome']}] {CLASS}.{r['method']} {r['message']}")
    summary = (run.get("result") or {}).get("summary", {})
    result = {"timestamp": K.now(), "commit": K.git_commit(), "class": CLASS,
              "org": {k: ident[k] for k in ("edition", "sandbox", "is_scratch", "api_version")},
              "passing": summary.get("passing"), "failing": summary.get("failing"), "tests": rows}
    if a.report:
        Path(a.report).write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    ok = bool(rows) and all(r["outcome"] == "Pass" for r in rows)
    K.say(f"RESULT: {len(rows)} test(s), {'all pass' if ok else 'FAILURES or no tests ran'}")
    return 0 if ok else 2


if __name__ == "__main__":
    try:
        sys.exit(main())
    except K.SfError as e:
        K.say(f"ERROR: {e}")
        sys.exit(1)
