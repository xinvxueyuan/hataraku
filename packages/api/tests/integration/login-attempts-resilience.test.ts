import { sql } from "drizzle-orm";
import { describe, expect, it } from "vite-plus/test";

import { createAuth } from "@hataraku/auth";

import { db, signUp } from "../support/api.ts";

const PASSWORD = "correct-horse-battery";

const auth = createAuth({
  baseURL: "http://localhost",
  db,
  secret: "test-secret-that-is-at-least-32-characters",
});

const signIn = async (email: string, password: string) => {
  const response = await auth.handler(
    new Request("http://localhost/api/auth/sign-in/email", {
      body: JSON.stringify({ email, password }),
      headers: {
        "content-type": "application/json",
        origin: "http://localhost",
      },
      method: "POST",
    })
  );

  await response.arrayBuffer();

  return response.status;
};

describe("login attempt audit resilience", () => {
  it("keeps the sign-in result when the audit row cannot be written", async () => {
    const email = `resilience-${crypto.randomUUID()}@example.com`;
    await signUp({ email });

    // The audit table is gone, as it would be on a deployment whose migration lagged. Signing in
    // must still work: the audit is an observation, not a step of authentication.
    await db.execute(sql`drop table "login_attempts"`);

    await expect(signIn(email, PASSWORD)).resolves.toBe(200);
    await expect(signIn(email, "wrong-password")).resolves.toBe(401);
  });
});
