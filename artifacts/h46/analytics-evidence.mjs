// H46 evidence: the analytics tag appears only when it is switched on and valid.
//
// Run from the repo root against a production build (and, for the dev check, a dev server):
//   node artifacts/h46/analytics-evidence.mjs http://localhost:3302 http://localhost:3303
//
// The profile row is read first and its analytics restored at the end, so the evidence leaves the
// database as it found it.
import { writeFileSync } from "node:fs";

const [prodUrl = "http://localhost:3302", devUrl = "http://localhost:3303"] = process.argv.slice(2);
const stamp = Date.now();
const password = "correct-horse-battery";

const signUp = await fetch(`${prodUrl}/api/auth/sign-up/email`, {
  body: JSON.stringify({ email: `h46-${stamp}@example.com`, name: "H46", password }),
  headers: { "content-type": "application/json", origin: prodUrl },
  method: "POST",
});

if (!signUp.ok) {
  throw new Error(`sign-up failed: ${signUp.status} ${await signUp.text()}`);
}

const cookie = signUp.headers
  .getSetCookie()
  .map((entry) => entry.split(";")[0])
  .join("; ");

const call = async (path, input, base = prodUrl) => {
  const response = await fetch(`${base}/rpc/${path}`, {
    body: JSON.stringify({ json: input }),
    headers: { "content-type": "application/json", cookie, origin: base },
    method: "POST",
  });

  const body = await response.json().catch(() => null);

  return { body: body?.json ?? body, ok: response.ok, status: response.status };
};

/** Every script tag in a page, attributes included, so a provider tag is counted rather than guessed at. */
const analyticsTags = async (base = prodUrl) => {
  const response = await fetch(`${base}/`, { headers: { cookie } });
  const html = await response.text();
  const matches = [...html.matchAll(/<script[^>]+src="([^"]+)"[^>]*>/gu)];

  return matches
    .map((match) => match[0])
    .filter(
      (tag) =>
        tag.includes("umami") ||
        tag.includes("plausible") ||
        tag.includes("googletagmanager")
    );
};

const original = await call("site/profile", undefined);

if (!original.ok) {
  throw new Error(`could not read the profile: ${original.status}`);
}

/** The payload the admin form would send: an absent column is an empty box, not a null. */
const formPayload = (analytics) => ({
  analytics,
  author: original.body.author ?? "",
  avatarUrl: original.body.avatarUrl ?? "",
  description: original.body.description ?? "",
  email: original.body.email ?? "",
  hero: {
    badge: original.body.hero?.badge ?? "",
    cta: original.body.hero?.cta ?? "",
    ctaHref: original.body.hero?.ctaHref ?? "",
    description: original.body.hero?.description ?? "",
    meta: original.body.hero?.meta ?? "",
    title: original.body.hero?.title ?? "",
  },
  name: original.body.name,
  nameEn: original.body.nameEn ?? "",
  social: original.body.social ?? {},
  tagline: original.body.tagline ?? "",
});

const write = async (analytics) =>
  await call("site/updateProfile", formPayload(analytics));

const states = {};

// 1. Nothing configured: the default row.
await write({
  enabled: false,
  provider: "none",
  respectDnt: true,
  scriptSrc: "",
  siteId: "",
});

states.defaultScripts = await analyticsTags();

// 2. Enabled umami with a site id: exactly one tag, carrying that id.
const siteId = `h46-${stamp}`;
const enabled = await write({
  enabled: true,
  provider: "umami",
  respectDnt: false,
  scriptSrc: "",
  siteId,
});

states.enabledWrite = enabled.ok;
states.enabledScripts = await analyticsTags();
states.enabledScriptCarriesId = states.enabledScripts.some((tag) => tag.includes(siteId));

// 3. Switched off but still configured: the state that is easy to get wrong.
await write({
  enabled: false,
  provider: "umami",
  respectDnt: false,
  scriptSrc: "",
  siteId,
});

states.disabledScripts = await analyticsTags();

// 4. Invalid input is refused with a readable message.
const unsafe = await write({
  enabled: true,
  provider: "custom",
  respectDnt: true,
  scriptSrc: "javascript:alert(1)",
  siteId: "",
});

states.javascriptRefused = unsafe.status === 400;
states.javascriptMessage = unsafe.body?.message ?? "";
// The field-level text is what a reader can act on: zod reports "Use an https URL" per issue.
states.javascriptIssues = (unsafe.body?.data?.issues ?? []).map(
  (issue) => issue.message
);

// 5. A development server never injects, even with the tag switched on.
await write({
  enabled: true,
  provider: "umami",
  respectDnt: false,
  scriptSrc: "",
  siteId,
});

states.productionScriptsWithTagOn = await analyticsTags();
states.developmentScriptsWithTagOn = await analyticsTags(devUrl);

// Put the row back the way it was found.
await call("site/updateProfile", formPayload(original.body.analytics));

const checks = {
  defaultInjectsNothing: states.defaultScripts.length === 0,
  enabledInjectsOne: states.enabledScripts.length === 1,
  enabledTagCarriesId: states.enabledScriptCarriesId,
  disabledWithConfigInjectsNothing: states.disabledScripts.length === 0,
  javascriptUrlRefused: states.javascriptRefused,
  readableError:
    states.javascriptMessage.length > 0 &&
    states.javascriptIssues.some((message) => message.includes("https")),
  productionInjectsWhenOn: states.productionScriptsWithTagOn.length === 1,
  developmentInjectsNothing: states.developmentScriptsWithTagOn.length === 0,
};

writeFileSync("artifacts/h46/evidence.json", JSON.stringify({ checks, original: original.body.analytics, states }, null, 2));

console.log(JSON.stringify({ checks, states }, null, 2));

if (Object.values(checks).some((value) => value !== true)) {
  process.exitCode = 1;
}