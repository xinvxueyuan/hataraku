// Creates the two probe accounts through Better Auth and stores their session cookies in a temp
// file. Sign-ups happen before the allowlist is enabled, because the allowlist gates account
// creation; the sessions stay valid afterwards as both processes share the secret and database.
import { writeFileSync } from "node:fs";

const base = process.env.PROBE_API_BASE ?? "http://localhost:3301";
const out = process.env.H21_COOKIE_FILE;

if (out === undefined || out === "") {
  throw new Error("H21_COOKIE_FILE is not set");
}

const accounts = [
  { email: "owner@h21.test", name: "Owner" },
  { email: "other@h21.test", name: "Other" },
];

const cookies = {};

for (const account of accounts) {
  const response = await fetch(base + "/api/auth/sign-up/email", {
    body: JSON.stringify({ ...account, password: "correct-horse-battery" }),
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3370",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("sign-up failed with " + response.status);
  }

  const session = response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .filter((pair) => pair.startsWith("better-auth.session_token="));

  if (session.length !== 1) {
    throw new Error("expected one session cookie, got " + session.length);
  }

  const pair = session[0];
  const index = pair.indexOf("=");
  cookies[account.email] = {
    name: pair.slice(0, index),
    value: pair.slice(index + 1),
  };
}

writeFileSync(out, JSON.stringify(cookies));
console.log("stored session cookies for", Object.keys(cookies).join(", "));
