import { createHmac } from "node:crypto";

import { eq } from "drizzle-orm";
import { describe, expect, it } from "vite-plus/test";

import { createAuth } from "@hataraku/auth";
import { loginAttempts } from "@hataraku/db/schema/audit";

import { db, signUp } from "../support/api.ts";

const SECRET = "test-secret-that-is-at-least-32-characters";
const PASSWORD = "correct-horse-battery";

const auth = createAuth({ baseURL: "http://localhost", db, secret: SECRET });

/** The digest the table should hold, computed independently of the writer under test. */
const digest = (value: string) =>
  createHmac("sha256", SECRET).update(value).digest("hex");

const signIn = async (email: string, password: string, address: string) => {
  const response = await auth.handler(
    new Request("http://localhost/api/auth/sign-in/email", {
      body: JSON.stringify({ email, password }),
      headers: {
        "content-type": "application/json",
        origin: "http://localhost",
        "x-forwarded-for": address,
      },
      method: "POST",
    })
  );

  await response.arrayBuffer();

  return response.status;
};

const attemptsFrom = async (address: string) =>
  await db
    .select()
    .from(loginAttempts)
    .where(eq(loginAttempts.ipHash, digest(address)));

describe("login attempt audit", () => {
  it("writes one row per sign-in with the outcome the caller saw", async () => {
    const email = `attempts-${crypto.randomUUID()}@example.com`;
    const address = "203.0.113.7";
    await signUp({ email });

    await expect(signIn(email, PASSWORD, address)).resolves.toBe(200);
    await expect(signIn(email, "wrong-password", address)).resolves.toBe(401);

    const rows = await attemptsFrom(address);

    expect(rows.map((row) => row.outcome).toSorted()).toStrictEqual([
      "invalid",
      "success",
    ]);
    expect(
      rows.every(
        (row) =>
          row.emailHash === digest(email) && Number.isInteger(row.durationMs)
      )
    ).toBeTruthy();

    // The raw identifiers never reach the table.
    const stored = JSON.stringify(rows);
    expect(stored.includes(email) || stored.includes(address)).toBeFalsy();
  });

  it("exposes the digest prefix and never the email digest on the read path", async () => {
    const email = `owner-${crypto.randomUUID()}@example.com`;
    const address = "198.51.100.9";
    const owner = await signUp({ adminEmails: email, email });

    await signIn(email, PASSWORD, address);
    await signIn(email, "wrong-password", address);

    const attempts = await owner.security.attempts();
    const prefix = digest(address).slice(0, 12);
    const rows = attempts.filter((attempt) => attempt.ipDigest === prefix);

    expect(rows.map((row) => row.outcome).toSorted()).toStrictEqual([
      "invalid",
      "success",
    ]);

    const returned = JSON.stringify(attempts);
    expect(returned).not.toContain(digest(address));
    expect(returned).not.toContain(digest(email));
  });
});
