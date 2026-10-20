import type { Session } from "@hataraku/auth";
import type { Database } from "@hataraku/db";

export interface Context {
  db: Database;
  session: Session | null;
}
