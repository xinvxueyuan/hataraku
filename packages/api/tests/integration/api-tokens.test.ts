import { createRouterClient } from "@orpc/server";
import { describe, expect, it } from "vite-plus/test";

import { apiTokens } from "@hataraku/db/schema/api-tokens";

import { appRouter } from "#src/index.ts";
import { generateToken, hashToken, resolveApiToken } from "#src/tokens.ts";
import type { ApiTokenPrincipal } from "#src/tokens.ts";

import { db, signUp } from "../support/api.ts";

const asToken = (principal: ApiTokenPrincipal | null) =>
  createRouterClient(appRouter, {
    context: { apiToken: principal, db, session: null },
  });

const tokenFrom = async (plain: string) =>
  await resolveApiToken(db, `Bearer ${plain}`);

const signOwner = async () => {
  const email = `owner-${crypto.randomUUID()}@example.com`;

  return await signUp({ adminEmails: email, email });
};

const createPost = async (client: ReturnType<typeof asToken>) =>
  await client.posts.create({
    bodyMd: "token-created body",
    title: `Token post ${crypto.randomUUID()}`,
  });

describe("api tokens", () => {
  it("creates a token, returns the plaintext once, and never lists it", async () => {
    const owner = await signOwner();

    const created = await owner.apiTokens.create({
      expiresInDays: 30,
      name: "external publisher",
      scopes: ["posts:write"],
    });

    expect(created.token).toMatch(/^hkr_[A-Za-z0-9_-]{43}$/u);
    expect(created.prefix).toHaveLength(12);
    const list = await owner.apiTokens.list();
    const row = list.find((item) => item.id === created.id);

    expect(row).toMatchObject({
      name: "external publisher",
      prefix: created.prefix,
    });
    expect(row).not.toHaveProperty("token");
    expect(row).not.toHaveProperty("tokenHash");
  });

  it("resolves the created token to its principal", async () => {
    const owner = await signOwner();

    const created = await owner.apiTokens.create({
      name: "resolver",
      scopes: ["posts:write"],
    });

    await expect(tokenFrom(created.token)).resolves.toStrictEqual({
      id: created.id,
      scopes: ["posts:write"],
    });
  });

  it("lets a scoped token create a post", async () => {
    const owner = await signOwner();

    const created = await owner.apiTokens.create({
      name: "post writer",
      scopes: ["posts:write"],
    });

    const principal = await tokenFrom(created.token);
    const client = asToken(principal);

    const post = await createPost(client);

    expect(post.title).toContain("Token post");
  });

  it("returns 403 for a token without the required scope", async () => {
    const owner = await signOwner();

    const created = await owner.apiTokens.create({
      name: "post only",
      scopes: ["posts:write"],
    });

    const client = asToken(await tokenFrom(created.token));

    await expect(
      client.content.micro.create({ content: "not allowed" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("returns 401 for a revoked token", async () => {
    const owner = await signOwner();

    const created = await owner.apiTokens.create({
      name: "to revoke",
      scopes: ["posts:write"],
    });

    const first = await owner.apiTokens.revoke({ id: created.id });
    const second = await owner.apiTokens.revoke({ id: created.id });

    expect(first.revokedAt).not.toBeNull();
    expect(second.revokedAt).toStrictEqual(first.revokedAt);
    await expect(tokenFrom(created.token)).resolves.toBeNull();
    await expect(createPost(asToken(null))).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("returns 401 for an expired token", async () => {
    const generated = generateToken();

    await db.insert(apiTokens).values({
      expiresAt: new Date(Date.now() - 1000),
      name: "expired",
      prefix: generated.prefix,
      scopes: ["posts:write"],
      tokenHash: hashToken(generated.token),
    });

    await expect(tokenFrom(generated.token)).resolves.toBeNull();
    await expect(createPost(asToken(null))).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("keeps post removal session-only", async () => {
    const owner = await signOwner();

    const created = await owner.apiTokens.create({
      name: "no delete",
      scopes: ["posts:write"],
    });

    const client = asToken(await tokenFrom(created.token));
    const post = await createPost(client);

    await expect(client.posts.remove({ id: post.id })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("keeps the session admin write path working", async () => {
    const owner = await signOwner();

    await expect(
      owner.posts.create({ bodyMd: "session body", title: "Session post" })
    ).resolves.toMatchObject({ title: "Session post" });
  });
});
