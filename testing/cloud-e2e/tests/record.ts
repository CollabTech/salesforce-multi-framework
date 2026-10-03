import { appendFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import type { TestInfo } from '@playwright/test';

/** One JSON line per observation in testing/cloud-e2e/results/observations.jsonl (sanitized:
 *  logical persona IDs only; no usernames, record IDs, org domains or session tokens). */
export function record(info: TestInfo, data: Record<string, unknown>): void {
  mkdirSync('results', { recursive: true });
  const build = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  const line = { ts: new Date().toISOString(), env: info.project.name, browser: info.project.use.channel ?? 'chromium',
    build, test: info.title, ...data };
  const clean = JSON.stringify(line).replace(/https:\/\/[A-Za-z0-9.-]+\.(salesforce|force|salesforce-setup|my\.salesforce)\.[a-z.]+/g, '<org-domain>')
    .replace(/\b(00D|005|500|069|068)[A-Za-z0-9]{12,15}\b/g, '<id>');
  appendFileSync('results/observations.jsonl', clean + '\n');
}
