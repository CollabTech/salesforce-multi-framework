import { createDataSDK, gql } from '@salesforce/platform-sdk';
import { executeGraphQL } from '@/api/graphqlClient';

/**
 * SMF-7 data access (experience-ui-bundle-salesforce-data-access): Apex REST via sdk.fetch for
 * the case-bound token, GraphQL (uiapi) to find the persona's permitted case. Hand-authored —
 * no org schema is available offline; validate with `npm run graphql:schema` once deployed.
 */

export const CALL_TOKEN_PATH = '/services/apexrest/smf7/v1/call-token';
/** MF-CASE-001 logical key (SMF-3 seed: Case.Subject). */
export const MF_CASE_001_SUBJECT = 'Pump overheating — remote diagnosis';

export type TokenResult =
  | { ok: true; authToken: string; displayName: string }
  | { ok: false; status: number; code: string; message: string };

/** Ask the org for a participant token for the case room. The token is returned, never logged. */
export async function requestCallToken(caseId: string): Promise<TokenResult> {
  const sdk = await createDataSDK();
  if (!sdk.fetch) {
    return { ok: false, status: 0, code: 'NO_SDK_FETCH', message: 'This surface does not expose sdk.fetch (not running inside Salesforce?).' };
  }
  let res: Response;
  try {
    res = await sdk.fetch(CALL_TOKEN_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ caseId }),
    });
  } catch (e) {
    return { ok: false, status: 0, code: 'NETWORK', message: e instanceof Error ? e.message : String(e) };
  }
  let body: { success?: boolean; code?: string; message?: string; authToken?: string; displayName?: string } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    // non-JSON (e.g. platform error page): fall through with status only
  }
  if (res.ok && body.success && body.authToken) {
    return { ok: true, authToken: body.authToken, displayName: body.displayName ?? '' };
  }
  return { ok: false, status: res.status, code: body.code ?? `HTTP_${res.status}`, message: body.message ?? res.statusText };
}

const FIND_CASE = gql`
  query Smf7FindCase($subject: String) {
    uiapi {
      query {
        Case(where: { Subject: { eq: $subject } }, first: 2) {
          edges {
            node {
              Id
            }
          }
        }
      }
    }
  }
`;

interface FindCaseQuery {
  uiapi: { query: { Case: { edges: { node: { Id: string } }[] } | null } };
}

/** Find MF-CASE-001 as the signed-in user (sharing applies: RESTRICTED finds nothing). */
export async function findPermittedCaseId(subject = MF_CASE_001_SUBJECT): Promise<string | null> {
  const data = await executeGraphQL<FindCaseQuery, { subject: string }>(FIND_CASE, { subject });
  const edges = data.uiapi.query.Case?.edges ?? [];
  return edges.length === 1 ? edges[0].node.Id : null;
}
