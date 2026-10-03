import { gql } from '@salesforce/platform-sdk';
import { executeGraphQL } from '@/api/graphqlClient';

// Hand-authored per experience-ui-bundle-salesforce-data-access (no org schema offline).
export const CURRENT_USER = gql`
  query CurrentUser {
    uiapi {
      currentUser {
        Id
        Name {
          value
        }
      }
    }
  }
`;

interface CurrentUserQuery {
  uiapi: { currentUser: { Id: string; Name: { value: string | null } | null } | null };
}

export interface CurrentUser {
  id: string;
  name: string | null;
}

export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  const data = await executeGraphQL<CurrentUserQuery, Record<string, never>>(CURRENT_USER);
  const u = data.uiapi.currentUser;
  return u ? { id: u.Id, name: u.Name?.value ?? null } : null;
}
