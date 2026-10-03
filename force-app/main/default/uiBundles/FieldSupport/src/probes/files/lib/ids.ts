/** Salesforce Id helpers. Ids are validated before they reach a URL path. */
const ID_PATTERN = /^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/;

export function isSalesforceId(value: string | null | undefined): value is string {
  return typeof value === 'string' && ID_PATTERN.test(value);
}

/**
 * Masks an Id for on-screen evidence: the 3-character key prefix (object type) and the
 * last 3 characters only. Full Ids belong in private/ notes, never in the public repo.
 */
export function maskId(value: string | null | undefined): string {
  if (!value) return '(none)';
  if (value.length < 8) return '***';
  return `${value.slice(0, 3)}…${value.slice(-3)}`;
}

export function sameId(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.slice(0, 15) === b.slice(0, 15);
}
