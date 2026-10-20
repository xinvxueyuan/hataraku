import { describe, expect, it } from "vite-plus/test";

import { createEmailAllowlist, parseAdminEmails } from "./allowlist.ts";

describe(parseAdminEmails, () => {
  it("splits, trims and lowercases a comma separated list", () => {
    expect(
      parseAdminEmails(" Owner@Example.com , second@example.com ")
    ).toStrictEqual(["owner@example.com", "second@example.com"]);
  });

  it("treats an unset or blank value as no entries", () => {
    expect(parseAdminEmails()).toStrictEqual([]);
    expect(parseAdminEmails("")).toStrictEqual([]);
    expect(parseAdminEmails(" , , ")).toStrictEqual([]);
  });
});

describe(createEmailAllowlist, () => {
  it("returns undefined so an unconfigured deployment stays open", () => {
    expect(createEmailAllowlist()).toBeUndefined();
    expect(createEmailAllowlist("")).toBeUndefined();
  });

  it("matches case-insensitively and ignores surrounding whitespace", () => {
    const isAllowed = createEmailAllowlist("Owner@Example.com");

    expect(isAllowed).toBeDefined();

    if (isAllowed === undefined) {
      throw new Error(
        "an allowlist was configured, so a predicate is expected"
      );
    }

    expect(isAllowed("owner@example.com")).toBeTruthy();
    expect(isAllowed("  OWNER@EXAMPLE.COM  ")).toBeTruthy();
    expect(isAllowed("someone-else@example.com")).toBeFalsy();
  });
});
