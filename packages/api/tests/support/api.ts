import { createRouterClient } from "@orpc/server";
import { afterAll } from "vite-plus/test";

import { createAuth } from "@hataraku/auth";
import { createTestDatabase } from "@hataraku/db/testing";

import { appRouter } from "#src/index.ts";
import type { Context } from "#src/index.ts";

// Each test file has a database of its own, so files run in parallel and share no rows.
const { db, remove } = await createTestDatabase();

/** Shared with the fixture seeder, so a test file seeds the same database its client reads. */
export { db };

afterAll(remove);

const auth = createAuth({
  baseURL: "http://localhost",
  db,
  secret: "test-secret-that-is-at-least-32-characters",
});

/**
 * Calls the procedures in this process, through their middleware and validation, as the session's
 * user. `adminEmails` is what the deployment would have in `ADMIN_EMAILS`: unset means any
 * signed-in account may write, a list means only those addresses may.
 */
export const createClient = (
  session: Context["session"] = null,
  adminEmails?: string
) => createRouterClient(appRouter, { context: { adminEmails, db, session } });

/**
 * Signs a new user up through Better Auth and returns a client that calls as them.
 *
 * A test that exercises the admin allowlist passes the same address in `email` and `adminEmails`,
 * or a different address in `adminEmails` to be refused.
 */
export const signUp = async (
  options: { adminEmails?: string; email?: string } = {}
) => {
  const { headers } = await auth.api.signUpEmail({
    body: {
      email: options.email ?? `${crypto.randomUUID()}@example.com`,
      name: "Test User",
      password: "correct-horse-battery",
    },
    returnHeaders: true,
  });

  const cookie = headers
    .getSetCookie()
    .map((header) => header.split(";")[0])
    .join("; ");

  return createClient(
    await auth.api.getSession({ headers: new Headers({ cookie }) }),
    options.adminEmails
  );
};
