/**
 * Declarative CORS policy for the R2 bucket that serves uploaded images.
 *
 * Uploads are presigned PUTs sent by the browser straight to R2, so the bucket's CORS policy is a
 * deployment prerequisite: without a PUT rule and an allowed origin the browser's preflight fails,
 * and the uploader only reports "Failed to fetch". The policy lives outside the repository, which is
 * how it drifts unnoticed — H18 spent time on exactly that. This script makes it checkable.
 *
 * Two rules, each with one job:
 * - public read: GET/HEAD from any origin. Fonts and images are requested cross-origin from the media
 *   host, so this rule stays open; it exposes the validators a browser needs.
 * - upload: PUT only, origins limited to the sites that run the admin UI. A leaked presigned URL
 *   cannot then be replayed from an unrelated origin. The origin list is configuration, never code:
 *   it comes from R2_UPLOAD_ALLOWED_ORIGINS and a wildcard is rejected.
 *
 * Usage:
 *   node scripts/configure-r2-cors.ts            # apply the expected policy, then read it back
 *   node scripts/configure-r2-cors.ts --check    # read-only: report drift, write nothing
 *
 * Exit codes:
 *   0  the bucket matches the expected policy (in apply mode: applied and verified)
 *   1  --check found drift; the bucket needs the expected policy
 *   2  configuration, network or API error; nothing was written
 *
 * Environment (values are never printed):
 *   CLOUDFLARE_API_TOKEN       API token with R2 edit permission
 *   R2_ACCOUNT_ID              Cloudflare account id
 *   R2_BUCKET                  bucket name; no default, because the wrong bucket must fail loudly
 *   R2_UPLOAD_ALLOWED_ORIGINS  comma separated origins allowed to PUT, for example
 *                              "https://a.example,http://localhost:3300"
 *   CLOUDFLARE_API_BASE        optional API base override; only a mock server sets it
 */

/* -------------------------------------------------------------------------- */
/* Errors                                                                      */
/* -------------------------------------------------------------------------- */

/** One error type with a kind, so the exit code distinguishes an operator mistake from an API fault. */
class ScriptError extends Error {
  readonly kind: "api" | "configuration";

  constructor(kind: "api" | "configuration", message: string) {
    super(message);
    this.name = "ScriptError";
    this.kind = kind;
  }
}

const configurationError = (message: string): ScriptError =>
  new ScriptError("configuration", message);

const apiError = (message: string): ScriptError =>
  new ScriptError("api", message);

/* -------------------------------------------------------------------------- */
/* JSON                                                                        */
/* -------------------------------------------------------------------------- */

type JsonValue =
  | boolean
  | number
  | string
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

const isJsonValue = (value: unknown): value is JsonValue => {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every((item) => isJsonValue(item));
  }

  if (typeof value !== "object") {
    return false;
  }

  return Object.values(value).every((item) => isJsonValue(item));
};

const isJsonObject = (
  value: JsonValue | undefined
): value is { [key: string]: JsonValue } =>
  value !== null &&
  value !== undefined &&
  typeof value === "object" &&
  !Array.isArray(value);

const isString = (value: JsonValue | undefined): value is string =>
  typeof value === "string";

const isNumber = (value: JsonValue | undefined): value is number =>
  typeof value === "number";

const stringList = (value: JsonValue | undefined): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item) => isString(item));
};

/* -------------------------------------------------------------------------- */
/* Configuration                                                               */
/* -------------------------------------------------------------------------- */

interface CorsRule {
  allowed: {
    headers: string[];
    methods: string[];
    origins: string[];
  };
  exposeHeaders: string[];
  maxAgeSeconds: number | null;
}

interface CorsConfig {
  accountId: string;
  apiBase: string;
  bucket: string;
  token: string;
  uploadOrigins: string[];
}

const PUBLIC_READ_RULE: CorsRule = {
  allowed: {
    headers: ["*"],
    methods: ["GET", "HEAD"],
    origins: ["*"],
  },
  exposeHeaders: ["Content-Type", "Content-Length", "ETag"],
  maxAgeSeconds: 86_400,
};

const UPLOAD_RULE_MAX_AGE_SECONDS = 3600;

const uploadRule = (origins: string[]): CorsRule => ({
  allowed: {
    headers: ["*"],
    methods: ["PUT"],
    origins,
  },
  exposeHeaders: ["ETag"],
  maxAgeSeconds: UPLOAD_RULE_MAX_AGE_SECONDS,
});

const expectedRules = (origins: string[]): [CorsRule, CorsRule] => [
  PUBLIC_READ_RULE,
  uploadRule(origins),
];

const requiredEnv = (
  environment: Record<string, string | undefined>,
  name: string
): string => {
  const value = (environment[name] ?? "").trim();

  if (value === "") {
    throw configurationError(
      `${
        name
      } is not set; the script reads every value from the environment and has no default`
    );
  }

  return value;
};

/**
 * One origin per value, as scheme://host[:port]. A trailing slash is accepted and dropped because it
 * is never part of an Origin header; anything with a path, query, fragment or wildcard is rejected.
 */
const parseOrigin = (value: string): string => {
  const trimmed = value.trim().replace(/\/+$/u, "");

  if (trimmed === "*") {
    throw configurationError(
      'R2_UPLOAD_ALLOWED_ORIGINS must not contain "*": a wildcard lets any site replay a presigned upload'
    );
  }

  let parsed: URL;

  try {
    parsed = new URL(trimmed);
  } catch {
    throw configurationError(
      `R2_UPLOAD_ALLOWED_ORIGINS contains an entry that is not an absolute URL: ${JSON.stringify(
        trimmed
      )}`
    );
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw configurationError(
      `R2_UPLOAD_ALLOWED_ORIGINS only accepts http and https origins: ${JSON.stringify(
        trimmed
      )}`
    );
  }

  if (
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.pathname !== "/" ||
    parsed.search !== "" ||
    parsed.hash !== ""
  ) {
    throw configurationError(
      `R2_UPLOAD_ALLOWED_ORIGINS entries must be origins without a path: ${JSON.stringify(
        trimmed
      )}`
    );
  }

  return parsed.origin;
};

const parseUploadOrigins = (raw: string): string[] => {
  const origins = raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "")
    .map((item) => parseOrigin(item));

  const unique = [...new Set(origins)].toSorted();

  if (unique.length === 0) {
    throw configurationError(
      "R2_UPLOAD_ALLOWED_ORIGINS is empty; list at least one origin"
    );
  }

  return unique;
};

const readConfig = (
  environment: Record<string, string | undefined>
): CorsConfig => ({
  accountId: requiredEnv(environment, "R2_ACCOUNT_ID"),
  apiBase: (
    environment.CLOUDFLARE_API_BASE ?? "https://api.cloudflare.com/client/v4"
  ).replace(/\/+$/u, ""),
  bucket: requiredEnv(environment, "R2_BUCKET"),
  token: requiredEnv(environment, "CLOUDFLARE_API_TOKEN"),
  uploadOrigins: parseUploadOrigins(
    requiredEnv(environment, "R2_UPLOAD_ALLOWED_ORIGINS")
  ),
});

/* -------------------------------------------------------------------------- */
/* API                                                                         */
/* -------------------------------------------------------------------------- */

const corsUrl = (config: CorsConfig): string =>
  `${config.apiBase}/accounts/${encodeURIComponent(
    config.accountId
  )}/r2/buckets/${encodeURIComponent(config.bucket)}/cors`;

interface ApiResponse {
  body: JsonValue | undefined;
  status: number;
}

const apiErrors = (body: JsonValue | undefined): string[] => {
  if (!isJsonObject(body) || !Array.isArray(body.errors)) {
    return [];
  }

  const messages: string[] = [];

  for (const error of body.errors) {
    if (!isJsonObject(error)) {
      continue;
    }

    const message = isString(error.message) ? error.message : "unknown error";
    const code = isNumber(error.code) ? ` (${String(error.code)})` : "";

    messages.push(message + code);
  }

  return messages;
};

const describeApiErrors = (messages: string[]): string =>
  messages.length === 0 ? "" : `: ${messages.join("; ")}`;

const parseRule = (value: JsonValue, index: number): CorsRule => {
  if (!isJsonObject(value) || !isJsonObject(value.allowed)) {
    throw apiError(
      `rule ${String(index + 1)} is not an object with an allowed block`
    );
  }

  const { allowed } = value;

  return {
    allowed: {
      headers: stringList(allowed.headers),
      methods: stringList(allowed.methods),
      origins: stringList(allowed.origins),
    },
    exposeHeaders: stringList(value.exposeHeaders),
    maxAgeSeconds: isNumber(value.maxAgeSeconds) ? value.maxAgeSeconds : null,
  };
};

const requestInit = (
  config: CorsConfig,
  method: "GET" | "PUT",
  payload: JsonValue | undefined
): RequestInit => {
  const headers = new Headers({ Authorization: `Bearer ${config.token}` });

  if (payload === undefined) {
    return { headers, method };
  }

  headers.set("content-type", "application/json");

  return { body: JSON.stringify(payload), headers, method };
};

const request = async (
  config: CorsConfig,
  method: "GET" | "PUT",
  payload?: JsonValue
): Promise<ApiResponse> => {
  const response = await fetch(
    corsUrl(config),
    requestInit(config, method, payload)
  );

  const text = await response.text();
  let body: JsonValue | undefined;

  if (text !== "") {
    let parsed: unknown;

    try {
      parsed = JSON.parse(text);
    } catch {
      throw apiError(
        `the API returned a non-JSON body (HTTP ${String(response.status)})`
      );
    }

    if (!isJsonValue(parsed)) {
      throw apiError(
        `the API returned a JSON shape this script cannot read (HTTP ${String(response.status)})`
      );
    }

    body = parsed;
  }

  return { body, status: response.status };
};

/** Reads the policy; undefined means the bucket has none, which is valid CORS for R2. */
const readCors = async (
  config: CorsConfig
): Promise<CorsRule[] | undefined> => {
  const response = await request(config, "GET");

  if (
    response.status === 404 &&
    apiErrors(response.body).some((error) => error.includes("10059"))
  ) {
    return undefined;
  }

  if (response.status < 200 || response.status >= 300) {
    throw apiError(
      `reading the CORS policy failed with HTTP ${String(response.status)}${describeApiErrors(apiErrors(response.body))}`
    );
  }

  if (!isJsonObject(response.body) || !isJsonObject(response.body.result)) {
    throw apiError("the API response has no result object");
  }

  const { rules } = response.body.result;

  if (rules === undefined) {
    return [];
  }

  if (!Array.isArray(rules)) {
    throw apiError("the API response has no rules array");
  }

  return rules.map((rule, index) => parseRule(rule, index));
};

/* -------------------------------------------------------------------------- */
/* Comparison                                                                  */
/* -------------------------------------------------------------------------- */

const quoteList = (values: string[]): string =>
  values.length === 0
    ? "[]"
    : values.map((value) => JSON.stringify(value)).join(", ");

const sameSet = (left: string[], right: string[]): boolean =>
  left.length === right.length && right.every((value) => left.includes(value));

const compareSet = (
  label: string,
  actual: string[],
  expected: string[]
): string[] => {
  const problems: string[] = [];
  const extra = actual.filter((value) => !expected.includes(value));
  const missing = expected.filter((value) => !actual.includes(value));

  if (extra.length > 0) {
    problems.push(`${label}: unexpected ${quoteList(extra)}`);
  }

  if (missing.length > 0) {
    problems.push(`${label}: missing ${quoteList(missing)}`);
  }

  return problems;
};

const compareRule = (
  label: string,
  rule: CorsRule,
  expected: CorsRule
): string[] => {
  const problems = compareSet(
    `${label} origins`,
    rule.allowed.origins,
    expected.allowed.origins
  );

  if (!sameSet(rule.allowed.methods, expected.allowed.methods)) {
    problems.push(
      `${label} methods: expected ${quoteList(
        expected.allowed.methods
      )}, got ${quoteList(rule.allowed.methods)}`
    );
  }

  if (!sameSet(rule.allowed.headers, expected.allowed.headers)) {
    problems.push(
      `${label} allowed headers: expected ${quoteList(
        expected.allowed.headers
      )}, got ${quoteList(rule.allowed.headers)}`
    );
  }

  if (!sameSet(rule.exposeHeaders, expected.exposeHeaders)) {
    problems.push(
      `${label} exposed headers: expected ${quoteList(
        expected.exposeHeaders
      )}, got ${quoteList(rule.exposeHeaders)}`
    );
  }

  if (rule.maxAgeSeconds !== expected.maxAgeSeconds) {
    problems.push(
      `${label} maxAgeSeconds: expected ${String(
        expected.maxAgeSeconds
      )}, got ${String(rule.maxAgeSeconds)}`
    );
  }

  return problems;
};

const allowsMethod = (rule: CorsRule, method: string): boolean =>
  rule.allowed.methods.some((candidate) => candidate.toUpperCase() === method);

/** Every way the bucket differs from the expected policy; empty means it matches. */
const driftAgainst = (
  actual: CorsRule[] | undefined,
  expected: [CorsRule, CorsRule]
): string[] => {
  if (actual === undefined) {
    return ["the bucket has no CORS policy"];
  }

  const publicRule = actual.filter(
    (rule) => allowsMethod(rule, "GET") || allowsMethod(rule, "HEAD")
  );

  const uploadRules = actual.filter((rule) => allowsMethod(rule, "PUT"));

  const otherRules = actual.filter(
    (rule) => !publicRule.includes(rule) && !uploadRules.includes(rule)
  );

  const problems: string[] = [];

  if (publicRule.length !== 1) {
    problems.push(
      `expected exactly one GET/HEAD rule, found ${String(publicRule.length)}`
    );
  }

  if (uploadRules.length !== 1) {
    problems.push(
      `expected exactly one PUT rule, found ${String(uploadRules.length)}`
    );
  }

  if (otherRules.length > 0) {
    problems.push(
      `unexpected extra rule(s): the policy holds only the public-read and upload rules, found ${String(
        otherRules.length
      )} other rule(s)`
    );
  }

  const [publicRead] = publicRule;
  const [upload] = uploadRules;

  if (publicRead !== undefined) {
    problems.push(...compareRule("public-read", publicRead, expected[0]));
  }

  if (upload !== undefined) {
    problems.push(...compareRule("upload", upload, expected[1]));
  }

  return problems;
};

/* -------------------------------------------------------------------------- */
/* Output                                                                      */
/* -------------------------------------------------------------------------- */

const printPolicy = (label: string, rules: CorsRule[] | undefined): void => {
  console.log(
    `${label}: ${
      rules === undefined ? "not configured" : `${rules.length} rule(s)`
    }`
  );

  for (const rule of rules ?? []) {
    console.log(
      `  methods=${JSON.stringify(
        rule.allowed.methods
      )} origins=${JSON.stringify(rule.allowed.origins)} maxAge=${String(
        rule.maxAgeSeconds
      )}`
    );
  }
};

const printProblems = (problems: string[]): void => {
  for (const problem of problems) {
    console.log(`  - ${problem}`);
  }
};

/* -------------------------------------------------------------------------- */
/* Main                                                                        */
/* -------------------------------------------------------------------------- */

/** The API takes plain JSON; the rule interface is widened here rather than asserted at the call. */
const toJsonRule = (rule: CorsRule): JsonValue => ({
  allowed: {
    headers: [...rule.allowed.headers],
    methods: [...rule.allowed.methods],
    origins: [...rule.allowed.origins],
  },
  exposeHeaders: [...rule.exposeHeaders],
  maxAgeSeconds: rule.maxAgeSeconds,
});

const applyPolicy = async (
  config: CorsConfig,
  expected: [CorsRule, CorsRule]
): Promise<number> => {
  const before = await readCors(config);

  printPolicy("current policy", before);

  const problems = driftAgainst(before, expected);

  if (problems.length === 0) {
    console.log(
      "OK: the bucket already matches the expected policy; nothing was written"
    );

    return 0;
  }

  console.log(
    `DRIFT: ${String(problems.length)} difference(s) from the expected policy:`
  );
  printProblems(problems);
  console.log("applying the expected policy...");

  const response = await request(config, "PUT", {
    rules: expected.map((rule) => toJsonRule(rule)),
  });

  if (response.status < 200 || response.status >= 300) {
    throw apiError(
      `writing the CORS policy failed with HTTP ${String(response.status)}${describeApiErrors(apiErrors(response.body))}`
    );
  }

  const after = await readCors(config);
  const remaining = driftAgainst(after, expected);

  printPolicy("policy after write", after);

  if (remaining.length > 0) {
    console.log("FAILED: the policy still differs after the write:");
    printProblems(remaining);

    return 2;
  }

  console.log(
    "OK: the policy was applied and read back identical to the expectation"
  );

  return 0;
};

const checkPolicy = async (
  config: CorsConfig,
  expected: [CorsRule, CorsRule]
): Promise<number> => {
  const actual = await readCors(config);

  printPolicy("current policy", actual);
  printPolicy("expected policy", expected);

  const problems = driftAgainst(actual, expected);

  if (problems.length === 0) {
    console.log(
      `OK: the bucket matches the expected policy (${String(
        config.uploadOrigins.length
      )} upload origin(s))`
    );

    return 0;
  }

  console.log(
    `DRIFT: ${String(problems.length)} difference(s) from the expected policy:`
  );
  printProblems(problems);
  console.log("run without --check to apply the expected policy");

  return 1;
};

const main = async (): Promise<number> => {
  const args = process.argv.slice(2);
  const unknown = args.filter((argument) => argument !== "--check");

  if (unknown.length > 0) {
    throw configurationError(
      `unknown argument(s): ${quoteList(unknown)}; the only flag is --check`
    );
  }

  const config = readConfig(process.env);
  const expected = expectedRules(config.uploadOrigins);
  const checkOnly = args.includes("--check");

  console.log(`bucket: ${config.bucket}`);
  console.log(
    `upload origins (${String(config.uploadOrigins.length)}): ${JSON.stringify(
      config.uploadOrigins
    )}`
  );
  console.log(`mode: ${checkOnly ? "check (read-only)" : "apply"}`);

  return checkOnly
    ? await checkPolicy(config, expected)
    : await applyPolicy(config, expected);
};

try {
  process.exitCode = await main();
} catch (error) {
  const configuration =
    error instanceof ScriptError && error.kind === "configuration";

  const message = error instanceof Error ? error.message : String(error);

  console.error(
    (configuration ? "configuration error: " : "error: ") + message
  );
  process.exitCode = 2;
}
