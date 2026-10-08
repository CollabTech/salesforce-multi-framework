#!/usr/bin/env python3
"""SMF-2 readiness probe: credentials present (names only) and per-host egress diagnostics.

For each host it records:
  - curl exit code and curl's own error message (`curl -sS`; exit 56 with "CONNECT tunnel
    failed, response 403" means the proxy refused the tunnel);
  - the HTTP status returned through the tunnel when the tunnel opens;
  - the egress proxy's CONNECT status line and response body. The body names the reason, for
    example `no rule or allowlist entry allows host "…"` for an allowlist denial versus an
    upstream failure.
HTTP 000 on its own is never treated as a policy rejection; the classification below uses the
proxy's diagnostic.

Sanitized: no secret values, proxy address, port, or local paths are written.
  python3 scripts/cloud/net_readiness.py [--out evidence/SMF-2/logs/readiness-YYYY-MM-DD.txt]
"""
import argparse, datetime, os, socket, subprocess, sys, urllib.parse

HOSTS = ["login.salesforce.com", "test.salesforce.com", "developer.salesforce.com",
         "api.cloudflare.com", "stun.cloudflare.com", "workers.dev", "dl.google.com",
         "packages.microsoft.com", "registry.npmjs.org"]
CREDS = ["SF_DEVHUB_USERNAME", "SF_DEVHUB_CLIENT_ID", "SF_DEVHUB_JWT_KEY", "SF_AUTH_URL_DEVHUB",
         "SMF_DEVHUB_ENABLE_OK", "CF_ACCOUNT_ID", "CF_API_TOKEN", "CF_RTK_ORG_TOKEN",
         "TLDRAW_LICENSE_KEY", "SMF_TESTER_EMAIL"]


def curl(host):
    r = subprocess.run(["curl", "-sS", "-o", "/dev/null", "-m", "20", "-w", "%{http_code}|%{http_connect}",
                        f"https://{host}/"], capture_output=True, text=True)
    http, _, connect = (r.stdout or "|").partition("|")
    return r.returncode, (r.stderr or "").strip().splitlines()[-1:] or [""], http, connect


def proxy_connect(host):
    """The egress proxy's own answer to CONNECT (status line + short body), or why none."""
    proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
    if not proxy:
        return "no proxy configured", ""
    p = urllib.parse.urlparse(proxy)
    try:
        s = socket.create_connection((p.hostname, p.port), timeout=15)
        s.sendall(f"CONNECT {host}:443 HTTP/1.1\r\nHost: {host}:443\r\n\r\n".encode())
        data = s.recv(4096).decode(errors="replace")
        s.close()
    except OSError as e:
        return f"proxy unreachable ({e.__class__.__name__})", ""
    head, _, body = data.partition("\r\n\r\n")
    return head.splitlines()[0] if head else "empty reply", body.strip()[:200]


def classify(rc, connect_status, body):
    if rc == 0:
        return "reachable"
    if "403" in connect_status and "no rule or allowlist entry allows host" in body:
        return "denied by environment network policy (allowlist)"
    if "403" in connect_status:
        return "proxy refused CONNECT (reason not stated as policy; see body)"
    if " 200 " in f" {connect_status} ":
        return "tunnel opened; failure upstream or in TLS/HTTP (see curl error)"
    return "unreachable (see curl error and proxy status)"


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--out")
    a = ap.parse_args()
    now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    lines = [f"# SMF-2 readiness probe {now} (cloud container; secret values never printed)", "",
             "## Credentials present in the environment (names only)"]
    lines += [f"- {v}: {'set' if os.environ.get(v) else 'unset'}" for v in CREDS]
    lines += ["", "## Egress per host",
              "| Host | curl exit | curl error | HTTP via tunnel | Proxy CONNECT reply | Proxy diagnostic | Classification |",
              "|---|---|---|---|---|---|---|"]
    for h in HOSTS:
        rc, err, http, connect = curl(h)
        status, body = proxy_connect(h)
        lines.append(f"| {h} | {rc} | {err[0].replace('|', '/') or '—'} | {http} | {status} | "
                     f"{body.replace('|', '/') or '—'} | {classify(rc, status, body)} |")
    sf = subprocess.run(["sf", "--version"], capture_output=True, text=True,
                        env={**os.environ, "SF_DISABLE_TELEMETRY": "true"})
    lines += ["", "## Tool versions", f"- sf CLI: {(sf.stdout or 'not installed').strip().splitlines()[0]}",
              f"- python: {sys.version.split()[0]}"]
    text = "\n".join(lines) + "\n"
    if a.out:
        os.makedirs(os.path.dirname(a.out), exist_ok=True)
        with open(a.out, "a", encoding="utf-8") as f:
            f.write(text + "\n")
    print(text)


if __name__ == "__main__":
    main()
