import { expect, test, type Request } from '@playwright/test';

// SMF-7 — ENV-EMULATION-LOCALHOST exploratory. No Salesforce org and no Cloudflare egress:
// the Apex token endpoint is STUBBED with page.route, so this exercises only the probe's
// client-side handling of the server's answers. It is not evidence of the Apex boundary,
// of RealtimeKit, or of any call.

const FAKE_JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJsIjoxfQ.ZmFrZS1zaWduYXR1cmUtbG9jYWxob3N0'; // synthetic: {"l":1}

async function stubCsrf(page: import('@playwright/test').Page): Promise<void> {
  await page.route('**/session/csrf**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ csrfToken: 'stub' }) }));
}

test('CALL-03 client: 403 from the token endpoint shows the denial and starts no call', async ({ page }) => {
  await stubCsrf(page);
  const rtk: Request[] = [];
  page.on('request', r => {
    if (r.url().includes('realtime.cloudflare.com')) rtk.push(r);
  });
  await page.route('**/services/apexrest/smf7/v1/call-token', r =>
    r.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ success: false, code: 'NO_CASE_ACCESS', message: 'You do not have access to this case or its call room.' }) }),
  );
  await page.goto('/probes/call');
  await page.getByTestId('manual-case').fill('case-other-synthetic');
  await page.getByTestId('join-manual').click();
  await expect(page.getByTestId('denial-code')).toHaveText('NO_CASE_ACCESS');
  await expect(page.getByTestId('phase')).toHaveText('denied');
  await page.waitForTimeout(2000);
  expect(rtk).toHaveLength(0);
});

test('CALL-03 client: a token the SDK cannot use fails once, no retry loop, token never rendered', async ({ page }) => {
  await stubCsrf(page);
  const rtk: string[] = [];
  page.on('request', r => {
    if (r.url().includes('realtime.cloudflare.com')) rtk.push(new URL(r.url()).host);
  });
  let tokenCalls = 0;
  await page.route('**/services/apexrest/smf7/v1/call-token', r => {
    tokenCalls += 1;
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, code: 'OK', authToken: FAKE_JWT, displayName: 'Localhost' }) });
  });
  await page.goto('/probes/call');
  await page.getByTestId('manual-case').fill('case-permitted-synthetic');
  await page.getByTestId('join-manual').click();
  await expect(page.getByTestId('phase')).toHaveText('failed', { timeout: 60_000 });
  const code = await page.getByTestId('failure-code').textContent();
  await page.waitForTimeout(10_000);
  const html = await page.content();
  test.info().annotations.push(
    { type: 'failure-code', description: code ?? '' },
    { type: 'token-endpoint-calls', description: String(tokenCalls) },
    { type: 'realtimekit-requests-attempted', description: `${rtk.length} (${[...new Set(rtk)].join(', ')})` },
  );
  expect(tokenCalls).toBe(1);
  expect(html).not.toContain(FAKE_JWT);
  expect(html).not.toContain('ZmFrZS1zaWduYXR1cmU');
  await expect(page.getByTestId('phase')).toHaveText('failed');
});

test('CALL-03 client: invalid-token control fails without any authorization request', async ({ page }) => {
  await stubCsrf(page);
  let tokenCalls = 0;
  await page.route('**/services/apexrest/smf7/v1/call-token', r => {
    tokenCalls += 1;
    return r.abort();
  });
  await page.goto('/probes/call');
  await page.getByTestId('join-invalid').click();
  await expect(page.getByTestId('phase')).toHaveText('failed', { timeout: 60_000 });
  test.info().annotations.push({ type: 'failure-code', description: (await page.getByTestId('failure-code').textContent()) ?? '' });
  expect(tokenCalls).toBe(0);
});

test('CALL-01 probe shows the fixed test phrase and marker controls', async ({ page }) => {
  await page.goto('/probes/call');
  await expect(page.getByTestId('test-phrase')).toContainText('Pump inlet check');
  await expect(page.getByTestId('join')).toBeDisabled(); // no case found without an org
});
