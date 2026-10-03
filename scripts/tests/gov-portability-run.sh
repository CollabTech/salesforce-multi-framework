#!/usr/bin/env bash
# SMF-1 GOV-01/GOV-03 portability acceptance run (run 3). Prints a sanitized log.
set -u
SRC=${SRC:-$(git rev-parse --show-toplevel)}
W=${1:?usage: gov-portability-run.sh <scratch-dir-to-create>}; case "$W" in /|"$HOME"|.) echo refuse; exit 2;; esac; rm -rf "$W"; mkdir -p "$W/home"
export HOME="$W/home"
step(){ echo; echo "### $*"; }
expect(){ # expect <FAIL|OK> <cmd...>
  want=$1; shift; out=$("$@" 2>&1); rc=$?
  got=OK; [ $rc -ne 0 ] && got=FAIL
  echo "$out" | sed 's/^/    /' | head -12
  [ "$got" = "$want" ] && echo "  => expected $want: yes" || { echo "  => expected $want, got $got: MISMATCH"; MISMATCH=1; }
}
MISMATCH=0
date -u +"started %FT%TZ"; echo "commit $(git -C $SRC rev-parse --short HEAD)"; python3 --version; node --version
step "A. fresh clone, empty HOME, before bootstrap"
git clone -q "$SRC" "$W/a" && cd "$W/a"
expect FAIL python3 scripts/verify-skills.py
step "A. bootstrap (network: github.com + registry.npmjs.org)"
expect OK python3 scripts/bootstrap-skills.py
echo "  tracked changes after bootstrap: $(git status --porcelain | wc -l)"
expect OK python3 scripts/check-test-plan.py
expect OK python3 scripts/scan-public-content.py
expect OK python3 -m unittest discover -s scripts/tests
step "B. negatives: official skill integrity"
echo "x" >> .agents/skills/dx-org-manage/SKILL.md;            expect FAIL python3 scripts/verify-skills.py; python3 scripts/bootstrap-skills.py >/dev/null
echo "x" > .agents/skills/dx-org-switch/extra.md;             expect FAIL python3 scripts/verify-skills.py; python3 scripts/bootstrap-skills.py >/dev/null
rm .agents/skills/platform-soql-query/README.md;              expect FAIL python3 scripts/verify-skills.py; python3 scripts/bootstrap-skills.py >/dev/null
python3 - <<'P'
import pathlib
for p in pathlib.Path('.agents/skills').rglob('*'):
    if p.is_file() and not p.is_symlink():
        b=p.read_bytes()
        if b'\0' not in b: p.write_bytes(b.replace(b'\r\n',b'\n').replace(b'\n',b'\r\n'))
P
echo "  converted every text file under .agents/skills to CRLF"
expect OK python3 scripts/verify-skills.py
python3 - <<'P'
import pathlib
p=pathlib.Path('.agents/skills/dx-org-manage/SKILL.md'); b=p.read_bytes(); p.write_bytes(b.replace(b'--target-org',b'--target-orh',1))
P
echo "  CRLF copy plus one changed byte"; expect FAIL python3 scripts/verify-skills.py
python3 scripts/bootstrap-skills.py >/dev/null; expect OK python3 scripts/verify-skills.py
step "C. negatives: .claude/skills entries"
rm .claude/skills/smf-evidence; printf '../../.agents/skills/smf-evidence' > .claude/skills/smf-evidence
echo "  text placeholder"; expect FAIL python3 scripts/verify-skills.py
expect OK python3 scripts/bootstrap-skills.py --offline
rm .claude/skills/smf-review; ln -s ../../.agents/skills/smf-evidence .claude/skills/smf-review
echo "  wrong target"; expect FAIL python3 scripts/verify-skills.py
rm .claude/skills/smf-review; ln -s ../../.agents/skills/nope .claude/skills/smf-review
echo "  dangling target"; expect FAIL python3 scripts/verify-skills.py
rm .claude/skills/smf-review; cp -r .agents/skills/smf-review .claude/skills/smf-review; echo stale >> .claude/skills/smf-review/SKILL.md
echo "  stale copy"; expect FAIL python3 scripts/verify-skills.py
rm -rf .claude/skills/smf-review; cp -r .agents/skills/smf-review .claude/skills/smf-review
echo "  identical copy (Windows fallback shape)"; expect OK python3 scripts/verify-skills.py
mkdir .claude/skills/stray; echo "  stray entry"; expect FAIL python3 scripts/verify-skills.py; rmdir .claude/skills/stray
python3 scripts/bootstrap-skills.py --offline >/dev/null
step "D. negatives: test-plan integrity and public content"
cp testing/test-plan-index.json /tmp/idx.bak
python3 -c "
import json;p='testing/test-plan-index.json';d=json.load(open(p));d['stories'][1]['cases'].append(dict(d['stories'][0]['cases'][0]));json.dump(d,open(p,'w'))"
echo "  duplicated case ID"; expect FAIL python3 scripts/check-test-plan.py; cp /tmp/idx.bak testing/test-plan-index.json
python3 -c "
import json;p='testing/test-plan-index.json';d=json.load(open(p));d['stories'][2]['cases'].pop();json.dump(d,open(p,'w'))"
echo "  dropped case ID"; expect FAIL python3 scripts/check-test-plan.py; cp /tmp/idx.bak testing/test-plan-index.json
python3 -c "
import json;p='testing/test-plan-index.json';d=json.load(open(p));d['stories'][0]['snapshot']='docs\\\\jira-snapshot\\\\2026-10-03\\\\SMF-1.md';json.dump(d,open(p,'w'))"
echo "  Windows-style backslash path in index"; expect FAIL python3 scripts/check-test-plan.py; cp /tmp/idx.bak testing/test-plan-index.json
f1="force:"; f2="//PlatformCLI::5Aep861abcdefghijklmnopqrstuvwxyz"; f3="@x.my.salesforce.com"; o1="00D5g"; o2="000004ABCDEAA"
printf 'url=%s%s%s\norg %s%s\n' "$f1" "$f2" "$f3" "$o1" "$o2" > docs/leak.md   # fake values, assembled at runtime so this script is not itself a scanner hit
echo "  planted auth URL + org ID"; expect FAIL python3 scripts/scan-public-content.py; rm docs/leak.md
step "E. clone with core.autocrlf=true (Windows default checkout behaviour)"
git -c core.autocrlf=true clone -q "$SRC" "$W/e" && cd "$W/e"
echo "  CRLF files among tracked text: $(git ls-files | xargs grep -lU $'\r' 2>/dev/null | wc -l)"
python3 - <<'P'
import pathlib
n=0
for p in ['testing/test-plan-index.json','testing/README.md','testing/contract.json']+[str(x) for x in pathlib.Path('docs/jira-snapshot').rglob('*.md')]+[str(x) for x in pathlib.Path('evidence').rglob('*.md')]:
    q=pathlib.Path(p); b=q.read_bytes(); q.write_bytes(b.replace(b'\r\n',b'\n').replace(b'\n',b'\r\n')); n+=1
print(f"  forced CRLF on {n} index/snapshot/evidence files (simulates .gitattributes absent)")
P
expect OK python3 scripts/check-test-plan.py
expect OK python3 scripts/bootstrap-skills.py
echo; [ $MISMATCH = 0 ] && echo "RESULT: all expectations met" || echo "RESULT: MISMATCHES PRESENT"
date -u +"finished %FT%TZ"
