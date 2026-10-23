import type { Session } from "@hataraku/auth";
import type { Database } from "@hataraku/db";

import type { ApiTokenPrincipal } from "#src/tokens.ts";

export interface Context {
  /** Present only for an authenticated, unrevoked, unexpired Bearer token. */
  apiToken?: ApiTokenPrincipal | null;
  db: Database;
  session: Session | null;
  /**
   * The raw `ADMIN_EMAILS` value. The API owns the rule that reads it, so every transport gets the
   * same decision: unset means the deployment is single-user, otherwise only listed addresses write.
   */
  adminEmails?: string | undefined;
}
