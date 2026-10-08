#!/usr/bin/env bash
# Cloud session setup for the SMF PoC (idempotent, non-interactive).
# Run as the first command of each Claude Code cloud session (idempotent; ~seconds when cached).
#   1. Salesforce CLI (npm, project-pinned major) on PATH, telemetry off
#   2. Official skills bootstrap (pinned, verified) — scripts/bootstrap-skills.py
#   3. Microsoft Edge stable (packages.microsoft.com) for ENV-DESKTOP-EDGE automation
#   4. UI bundle dependencies (if the SMF-4 scaffold is present)
#   5. Org authentication from environment secrets, if provided (scripts/cloud/connect-orgs.sh)
# Every step reports OK / SKIP / BLOCKED (with the missing prerequisite) and never prints secrets.
set -uo pipefail
ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"
cd "$ROOT"
ENVF="${CLAUDE_ENV_FILE:-/dev/null}"
SFDIR=/opt/sfcli
log(){ printf '[smf-setup] %s\n' "$*" >&2; }

# 1. Salesforce CLI
if [ ! -x "$SFDIR/node_modules/.bin/sf" ]; then
  mkdir -p "$SFDIR" && (cd "$SFDIR" && npm install --silent --no-audit --no-fund @salesforce/cli@2 >/dev/null 2>&1) \
    && log "OK  sf CLI installed" || log "BLOCKED sf CLI install failed (needs registry.npmjs.org)"
fi
export PATH="$SFDIR/node_modules/.bin:$PATH" SF_DISABLE_TELEMETRY=true SF_AUTOUPDATE_DISABLE=true
{ echo "export PATH=\"$SFDIR/node_modules/.bin:\$PATH\""; echo 'export SF_DISABLE_TELEMETRY=true'; echo 'export SF_AUTOUPDATE_DISABLE=true'; } >> "$ENVF"
command -v sf >/dev/null && log "OK  $(sf --version 2>/dev/null | head -1)"

# 2. Skills
if python3 scripts/verify-skills.py >/dev/null 2>&1; then log "OK  skills verified"
else python3 scripts/bootstrap-skills.py >/dev/null 2>&1 && log "OK  skills bootstrapped" || log "BLOCKED skills bootstrap failed (needs github.com + registry.npmjs.org)"; fi

# 3. Microsoft Edge (Playwright channel 'msedge'); Chromium is preinstalled at /opt/pw-browsers
if ! command -v microsoft-edge >/dev/null 2>&1; then
  base=https://packages.microsoft.com/repos/edge
  deb=$(curl -fsS -m 60 "$base/dists/stable/main/binary-amd64/Packages" 2>/dev/null \
        | awk '/^Package: microsoft-edge-stable/{p=1} p&&/^Version/{v=$2} p&&/^Filename/{print v" "$2; p=0}' | sort -V | tail -1 | cut -d' ' -f2)
  if [ -n "$deb" ] && curl -fsS -m 600 -o /tmp/msedge.deb "$base/$deb" && apt-get install -y -q /tmp/msedge.deb >/tmp/msedge-install.log 2>&1; then
    log "OK  $(microsoft-edge --version)"
  else log "BLOCKED Microsoft Edge install failed (needs packages.microsoft.com + archive.ubuntu.com)"; fi
  rm -f /tmp/msedge.deb
else log "OK  $(microsoft-edge --version)"; fi
CHROMIUM=$(ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome 2>/dev/null | sort -V | tail -1)
[ -n "$CHROMIUM" ] && echo "export PW_CHROMIUM_PATH=$CHROMIUM" >> "$ENVF"

# 4. Bundle dependencies
B=force-app/main/default/uiBundles/FieldSupport
if [ -f "$B/package.json" ]; then
  (cd "$B" && npm install --no-audit --no-fund >/dev/null 2>&1) && log "OK  bundle deps" || log "BLOCKED bundle npm install failed"
fi

# 5. Orgs
if [ -n "${SF_AUTH_URL_DEVHUB:-}" ] || [ -n "${SF_DEVHUB_JWT_KEY:-}" ]; then bash scripts/cloud/connect-orgs.sh || log "BLOCKED org connection failed (see output above)"
else log "SKIP orgs: SF_AUTH_URL_DEVHUB not set (docs/cloud/HUMAN-SETUP.md H1+H2)"; fi
exit 0
