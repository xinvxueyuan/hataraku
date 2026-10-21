import "server-only";
import { redirect } from "next/navigation";

import { createEmailAllowlist } from "@hataraku/auth";

import { readEnv } from "#src/server/env.ts";
import { getSession } from "#src/server/session.ts";

/** The refusal the API answers with when a call is not allowed. */
const REFUSALS = ["BAD_REQUEST", "FORBIDDEN", "NOT_FOUND"] as const;

type RefusalCode = (typeof REFUSALS)[number];

interface Refusal {
  readonly code: RefusalCode;
}

/** A refused call carries its oRPC code; anything else is a real fault and must propagate. */
const isRefusal = (error: unknown): error is Refusal =>
  error instanceof Error &&
  "code" in error &&
  REFUSALS.some((code) => code === error.code);

/**
 * True when the API refused the call because the account is not on the write allowlist.
 *
 * The decision is the API's; a page only renders what the refusal means.
 */
export const isForbidden = (error: unknown): error is Refusal =>
  isRefusal(error) && error.code === "FORBIDDEN";

/** True when a post id names nothing the editor can open. */
export const isMissingPost = (error: unknown): error is Refusal =>
  isRefusal(error) &&
  (error.code === "NOT_FOUND" || error.code === "BAD_REQUEST");

/**
 * The page half of the write gate: a visitor without a session is sent to sign-in and comes back
 * here. Whether the account may write is decided by the API, so this only proves someone is signed
 * in — hiding the page is UX, the procedure is the boundary.
 */
export const requireSession = async (path: string) => {
  const session = await getSession();

  if (!session) {
    redirect(`/login?redirect=${encodeURIComponent(path)}`);
  }

  return session;
};

/**
 * Whether an account belongs to the site owner, mirroring `adminProcedure`.
 *
 * `ADMIN_EMAILS` is the allowlist; unset (or empty) means this is a single-user deployment — the
 * same reading sign-up and the write procedures use — so every signed-in account is the owner.
 * The menu uses this only to decide whether to offer the writing desk: the API still authorizes
 * every call, so hiding the entry is UX and not the security boundary.
 */
export const isSiteOwner = (email: string): boolean => {
  const allowlist = createEmailAllowlist(readEnv().ADMIN_EMAILS);

  return allowlist === undefined || allowlist(email);
};
