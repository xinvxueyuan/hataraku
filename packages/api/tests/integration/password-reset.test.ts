import { describe, expect, it } from "vite-plus/test";

import { createAuth } from "@hataraku/auth";

import { db, signUp } from "../support/api.ts";

const SECRET = "test-secret-that-is-at-least-32-characters";
const PASSWORD = "correct-horse-battery";
const NEW_PASSWORD = "correct-horse-battery-staple";

interface CapturedMessage {
  from: string;
  html: string;
  subject: string;
  text: string;
  to: string;
}

/**
 * Builds an auth instance whose mail transport is a capture. The instance owns its rate-limit memory,
 * so a test that spends the reset budget does not affect the others.
 */
const makeAuth = (messages: CapturedMessage[]) =>
  createAuth({
    baseURL: "http://localhost",
    db,
    emailFrom: "夜行栈 <noreply@example.com>",
    secret: SECRET,
    sendEmail: async (message) => {
      // The transport seam is async by contract; a capture has nothing to wait for.
      await Promise.resolve();
      messages.push(message);
    },
  });

const requestReset = async (
  auth: ReturnType<typeof makeAuth>,
  email: string,
  redirectTo = "http://localhost/reset-password"
) =>
  await auth.api.requestPasswordReset({
    body: { email, redirectTo },
  });

const firstMessage = (messages: CapturedMessage[]): CapturedMessage => {
  const [message] = messages;

  if (message === undefined) {
    throw new Error("no reset mail was captured");
  }

  return message;
};

/** The token the reader would click; it travels inside the link Better Auth built. */
const tokenFrom = (message: CapturedMessage): string => {
  const link = /https?:\/\/\S+/u.exec(message.text)?.[0] ?? "";

  const token = /\/reset-password\/(?<token>[^?\s]+)/u.exec(link)?.groups
    ?.token;

  if (token === undefined || token === "") {
    throw new Error("the reset mail carried no token");
  }

  return token;
};

const signIn = async (
  auth: ReturnType<typeof makeAuth>,
  email: string,
  password: string
) => {
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

describe("password reset by email", () => {
  it("mails a token to the registered address and the new password signs in", async () => {
    const messages: CapturedMessage[] = [];
    const auth = makeAuth(messages);
    const email = `reset-${crypto.randomUUID()}@example.com`;
    await signUp({ email });

    await expect(requestReset(auth, email)).resolves.toMatchObject({
      status: true,
    });
    // Exactly one message, to that address, about a password reset.
    expect(
      messages.map((message) => [message.to, message.subject])
    ).toStrictEqual([[email, "重置登录密码"]]);

    await expect(
      auth.api.resetPassword({
        body: {
          newPassword: NEW_PASSWORD,
          token: tokenFrom(firstMessage(messages)),
        },
      })
    ).resolves.toMatchObject({ status: true });

    const signIns = await Promise.all([
      signIn(auth, email, PASSWORD),
      signIn(auth, email, NEW_PASSWORD),
    ]);

    expect(signIns).toStrictEqual([401, 200]);
  });

  it("answers the same for an unknown address and sends nothing", async () => {
    const messages: CapturedMessage[] = [];
    const auth = makeAuth(messages);
    const email = `reset-${crypto.randomUUID()}@example.com`;
    await signUp({ email });

    const known = await requestReset(auth, email);
    const unknown = await requestReset(auth, "nobody@example.com");

    expect(unknown.status).toBe(known.status);
    expect(unknown.message).toBe(known.message);
    // Only the registered address produced a message.
    expect(messages).toHaveLength(1);
    expect(messages[0]?.to).toBe(email);
  });

  it("rejects a token that was never issued", async () => {
    const messages: CapturedMessage[] = [];
    const auth = makeAuth(messages);

    await expect(
      auth.api.resetPassword({
        body: { newPassword: NEW_PASSWORD, token: "not-a-real-token" },
      })
    ).rejects.toMatchObject({
      body: { code: "INVALID_TOKEN" },
      statusCode: 400,
    });
  });

  it("checks the length floor before spending the token", async () => {
    const messages: CapturedMessage[] = [];
    const auth = makeAuth(messages);
    const email = `reset-${crypto.randomUUID()}@example.com`;
    await signUp({ email });

    await requestReset(auth, email);
    const token = tokenFrom(firstMessage(messages));

    await expect(
      auth.api.resetPassword({
        body: { newPassword: "a".repeat(15), token },
      })
    ).rejects.toMatchObject({
      body: { code: "PASSWORD_TOO_SHORT" },
      statusCode: 400,
    });

    // The refusal did not consume the link.
    await expect(
      auth.api.resetPassword({ body: { newPassword: NEW_PASSWORD, token } })
    ).resolves.toMatchObject({ status: true });
  });

  it("consumes the token after a successful reset", async () => {
    const messages: CapturedMessage[] = [];
    const auth = makeAuth(messages);
    const email = `reset-${crypto.randomUUID()}@example.com`;
    await signUp({ email });

    await requestReset(auth, email);
    const token = tokenFrom(firstMessage(messages));

    await auth.api.resetPassword({
      body: { newPassword: NEW_PASSWORD, token },
    });

    await expect(
      auth.api.resetPassword({
        body: { newPassword: "another-long-password", token },
      })
    ).rejects.toMatchObject({
      body: { code: "INVALID_TOKEN" },
      statusCode: 400,
    });
  });

  it("throttles reset requests through Better Auth's own rule", async () => {
    const messages: CapturedMessage[] = [];
    const auth = makeAuth(messages);

    const post = async () => {
      const response = await auth.handler(
        new Request("http://localhost/api/auth/request-password-reset", {
          body: JSON.stringify({ email: "throttle@example.com" }),
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

    const statuses = await Promise.all(
      Array.from({ length: 4 }, async () => await post())
    );

    // Better Auth's default special rule for this endpoint is 3 per 60 seconds.
    expect(statuses.toSorted((left, right) => left - right)).toStrictEqual([
      200, 200, 200, 429,
    ]);
  });
});
