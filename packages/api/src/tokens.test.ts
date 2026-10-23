import { describe, expect, it } from "vite-plus/test";

import {
  API_SCOPES,
  generateToken,
  hashToken,
  hasScope,
  isApiScope,
  parseBearer,
} from "#src/tokens.ts";

describe("API token utilities", () => {
  it("generates a 32-byte base64url token and a short prefix", () => {
    const generated = generateToken();

    expect(generated.token).toMatch(/^hkr_[A-Za-z0-9_-]{43}$/u);
    expect(generated.prefix).toHaveLength(12);
    expect(generated.token.startsWith(generated.prefix)).toBeTruthy();
    expect(generateToken().token).not.toBe(generated.token);
  });

  it("hashes with SHA-256 hex and is deterministic", () => {
    expect(hashToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
    expect(hashToken("hkr_value")).toBe(hashToken("hkr_value"));
  });

  it("accepts exactly one Bearer shape", () => {
    const { token } = generateToken();

    expect(parseBearer(`Bearer ${token}`)).toBe(token);
  });

  it.each([
    null,
    undefined,
    "",
    "Basic abc",
    "bearer hkr_value",
    "Bearer  hkr_value",
    "Bearer hkr_short",
  ])("rejects malformed authorization %j", (header) => {
    expect(parseBearer(header)).toBeNull();
  });

  it("matches only known scopes", () => {
    expect(hasScope(["posts:write"], "posts:write")).toBeTruthy();
    expect(hasScope(["notes:write"], "posts:write")).toBeFalsy();
    expect(isApiScope("admin")).toBeFalsy();
    expect(API_SCOPES).toHaveLength(4);
  });
});
