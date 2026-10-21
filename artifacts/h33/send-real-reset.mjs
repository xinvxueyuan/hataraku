// Sends a real password-reset email through the running app and records the link Resend accepted.
//
// The API key arrives in RESEND_API_KEY (the caller reads it from the secret store); nothing here
// prints it. Only the link's origin and shape are logged — the token is written to H33_LINK_FILE
// for the next step.
import { writeFileSync } from "node:fs";

const base = process.env.PROBE_API_BASE ?? "http://localhost:3001";
const email = process.env.H33_EMAIL ?? "xinvxueyuan@yeah.net";
const password = process.env.H33_INITIAL_PASSWORD ?? "initial-horse-battery";
const webOrigin = process.env.H33_WEB_ORIGIN;
const apiKey = process.env.RESEND_API_KEY;
const linkFile = process.env.H33_LINK_FILE;

if (!webOrigin || !apiKey || !linkFile) {
  throw new Error("H33_WEB_ORIGIN, RESEND_API_KEY and H33_LINK_FILE are required");
}

const post = async (path, body) => {
  const response = await fetch(base + path, {
    body: JSON.stringify(body),
    // Better Auth refuses a mutation without an Origin; the configured origin is the trusted one.
    headers: { "content-type": "application/json", origin: webOrigin },
    method: "POST",
  });
  const text = await response.text();
  return { status: response.status, text };
};

const signUp = await post("/api/auth/sign-up/email", {
  email,
  name: "站长",
  password,
});
console.log("sign-up:", signUp.status, signUp.status === 200 ? "ok" : signUp.text.slice(0, 120));

const requested = await post("/api/auth/request-password-reset", {
  email,
  redirectTo: `${webOrigin}/reset-password`,
});
console.log("request-password-reset:", requested.status, requested.text.slice(0, 160));

// The newest mail to that address is the one this run just caused.
const listResponse = await fetch("https://api.resend.com/emails?limit=10", {
  headers: { Authorization: "Bearer " + apiKey },
});
if (!listResponse.ok) {
  throw new Error("listing Resend emails failed: " + listResponse.status);
}
const list = await listResponse.json();
const message = (list.data ?? []).find(
  (candidate) =>
    Array.isArray(candidate.to) &&
    candidate.to.includes(email) &&
    String(candidate.subject).includes("重置")
);
if (!message) {
  throw new Error("no reset email found in the Resend list");
}
console.log("resend message:", message.id, "last_event:", message.last_event);

const detailResponse = await fetch("https://api.resend.com/emails/" + message.id, {
  headers: { Authorization: "Bearer " + apiKey },
});
if (!detailResponse.ok) {
  throw new Error("fetching the sent email failed: " + detailResponse.status);
}
const detail = await detailResponse.json();
const link = /https?:\/\/\S+/u.exec(detail.text ?? "")?.[0];
if (!link) {
  throw new Error("the sent email carried no link");
}

const parsed = new URL(link);
const token = /\/reset-password\/(?<token>[^?]+)/u.exec(parsed.pathname)?.groups?.token;
if (!token) {
  throw new Error("the link carried no reset token");
}
console.log("link origin:", parsed.origin);
console.log("link path:", parsed.pathname.replace(token, "<token>"));
console.log("callbackURL present:", parsed.searchParams.has("callbackURL"));
console.log("token length:", token.length);
console.log("subject:", detail.subject, "| to:", (detail.to ?? []).join(","));

writeFileSync(linkFile, JSON.stringify({ link, messageId: message.id, token }));
console.log("link recorded for the next step");