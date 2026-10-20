import { eq } from "drizzle-orm";
import { describe, expect, it } from "vite-plus/test";

import { loginAttempts } from "@hataraku/db/schema/audit";
import { session, user } from "@hataraku/db/schema/auth";

import { createClient, db, signUp } from "../support/api.ts";

const anonymous = createClient();

/** One row, or a loud failure: an empty fixture would make the assertion meaningless. */
const one = <T>(rows: T[]): T => {
  const [row] = rows;

  if (row === undefined) {
    throw new Error("expected one row");
  }

  return row;
};

const userByEmail = async (email: string) =>
  one(await db.select().from(user).where(eq(user.email, email)));

const sessionsOf = async (userId: string) =>
  await db.select().from(session).where(eq(session.userId, userId));

const address = (label: string) =>
  `${label}-${crypto.randomUUID()}@example.com`;

describe("security.overview", () => {
  it("rejects an anonymous caller with UNAUTHORIZED", async () => {
    await expect(anonymous.security.overview()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("lists the caller's own sessions and never another account's", async () => {
    const emailA = address("a");
    const emailB = address("b");
    const clientA = await signUp({ email: emailA });
    await signUp({ email: emailB });

    const accountA = await userByEmail(emailA);
    const accountB = await userByEmail(emailB);
    const sessionA = one(await sessionsOf(accountA.id));
    const sessionB = one(await sessionsOf(accountB.id));

    const overview = await clientA.security.overview();
    const ids = overview.activeSessions.map((row) => row.id);

    expect(ids).toContain(sessionA.id);
    expect(ids).not.toContain(sessionB.id);
    expect(overview.activeSessions.filter((row) => row.isCurrent)).toHaveLength(
      1
    );
    expect(overview.activeSessions.find((row) => row.isCurrent)?.id).toBe(
      sessionA.id
    );
    expect(overview).toMatchObject({ twoFactorEnabled: false });
  });

  it("leaves expired sessions out of the active list", async () => {
    const email = address("expired");
    const client = await signUp({ email });
    const account = await userByEmail(email);
    const current = one(await sessionsOf(account.id));
    const expiredId = crypto.randomUUID();

    await db.insert(session).values({
      expiresAt: new Date("2020-01-01T00:00:00Z"),
      id: expiredId,
      token: crypto.randomUUID(),
      userId: account.id,
    });

    const overview = await client.security.overview();

    expect(overview.activeSessions.map((row) => row.id)).toStrictEqual([
      current.id,
    ]);
    expect(overview.activeSessions.map((row) => row.id)).not.toContain(
      expiredId
    );
  });
});

describe("security.attempts", () => {
  it("rejects an anonymous caller with UNAUTHORIZED", async () => {
    await expect(anonymous.security.attempts()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("refuses an account outside ADMIN_EMAILS with FORBIDDEN", async () => {
    const client = await signUp({ adminEmails: "owner@example.com" });

    await expect(client.security.attempts()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("shows the site owner the newest attempts with truncated digests", async () => {
    const email = address("owner");
    const owner = await signUp({ adminEmails: email, email });

    const ipHash = "0123456789abcdef".repeat(4);
    await db.insert(loginAttempts).values({
      createdAt: new Date("2026-01-01T00:00:00Z"),
      emailHash: "e".repeat(64),
      ipHash,
      outcome: "password_fail",
    });
    await db.insert(loginAttempts).values({
      createdAt: new Date("2026-01-02T00:00:00Z"),
      durationMs: 42,
      emailHash: "e".repeat(64),
      ipHash,
      outcome: "sent",
    });

    const attempts = await owner.security.attempts();

    expect(attempts.length).toBeGreaterThanOrEqual(2);
    expect(attempts[0]).toMatchObject({
      durationMs: 42,
      ipDigest: ipHash.slice(0, 12),
      outcome: "sent",
    });
    expect(attempts[0]?.ipDigest).toHaveLength(12);
    // The full digest and the stored email digest never leave the API.
    expect(JSON.stringify(attempts)).not.toContain(ipHash);
    expect(JSON.stringify(attempts)).not.toContain("e".repeat(64));
  });
});
