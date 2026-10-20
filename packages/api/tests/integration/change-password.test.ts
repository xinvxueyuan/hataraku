import { describe, expect, it } from "vite-plus/test";

import { createAuth } from "@hataraku/auth";

import { db } from "../support/api.ts";

const SECRET = "test-secret-that-is-at-least-32-characters";
const PASSWORD = "correct-horse-battery";
const NEW_PASSWORD = "correct-horse-battery-staple";

const auth = createAuth({ baseURL: "http://localhost", db, secret: SECRET });

const address = (label: string) =>
  `${label}-${crypto.randomUUID()}@example.com`;

/** Signs a user up through Better Auth and returns the session cookie it sets. */
const signUp = async (email: string, password = PASSWORD) => {
  const { headers } = await auth.api.signUpEmail({
    body: { email, name: "Password Test", password },
    returnHeaders: true,
  });

  return headers
    .getSetCookie()
    .map((header) => header.split(";")[0])
    .join("; ");
};

const changePassword = async (
  cookie: string,
  body: { currentPassword: string; newPassword: string }
) =>
  await auth.api.changePassword({
    body,
    headers: new Headers({ cookie }),
  });

/** The real HTTP sign-in path, so the outcome is the one a browser would see. */
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

describe("change password", () => {
  it("replaces the password: the old one stops working and the new one signs in", async () => {
    const email = address("change");
    const cookie = await signUp(email);

    await expect(
      changePassword(cookie, {
        currentPassword: PASSWORD,
        newPassword: NEW_PASSWORD,
      })
    ).resolves.toMatchObject({ user: { email } });

    await expect(signIn(email, PASSWORD)).resolves.toBe(401);
    await expect(signIn(email, NEW_PASSWORD)).resolves.toBe(200);
  });

  it("refuses a wrong current password with a code the page can explain", async () => {
    const email = address("wrong-current");
    const cookie = await signUp(email);

    await expect(
      changePassword(cookie, {
        currentPassword: "not-the-password",
        newPassword: NEW_PASSWORD,
      })
    ).rejects.toMatchObject({
      body: { code: "INVALID_PASSWORD" },
      statusCode: 400,
    });
  });

  it("keeps the v2 floor of 16 characters, accepting exactly 16", async () => {
    const email = address("policy");
    const cookie = await signUp(email);
    const sixteen = "a".repeat(16);

    await expect(
      changePassword(cookie, {
        currentPassword: PASSWORD,
        newPassword: "a".repeat(15),
      })
    ).rejects.toMatchObject({
      body: { code: "PASSWORD_TOO_SHORT" },
      statusCode: 400,
    });

    await expect(
      changePassword(cookie, {
        currentPassword: PASSWORD,
        newPassword: sixteen,
      })
    ).resolves.toBeTruthy();

    await expect(signIn(email, sixteen)).resolves.toBe(200);
  });

  it("applies the same floor to sign-up", async () => {
    await expect(
      auth.api.signUpEmail({
        body: {
          email: address("short-signup"),
          name: "Short",
          password: "a".repeat(15),
        },
      })
    ).rejects.toMatchObject({
      body: { code: "PASSWORD_TOO_SHORT" },
      statusCode: 400,
    });
  });
});
