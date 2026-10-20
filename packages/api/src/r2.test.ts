import { describe, expect, it } from "vite-plus/test";

import {
  ALLOWED_MIME_TYPES,
  planUpload,
  UPLOAD_MAX_BYTES,
  UPLOAD_PREFIXES,
} from "#src/r2.ts";

const at = new Date("2026-10-21T02:03:04.000Z");

const plan = (overrides: Partial<Parameters<typeof planUpload>[0]> = {}) =>
  planUpload(
    {
      contentType: "image/png",
      prefix: "projects",
      scope: "night-runner",
      size: 2048,
      ...overrides,
    },
    at
  );

/**
 * The plan is what the signer puts in the object key, so its shape is the policy: a key that does
 * not match these rules either escapes its prefix or carries an extension the browser chose.
 */
describe(planUpload, () => {
  it("builds <prefix>/<scope>/<stamp>-<random>.<ext>", () => {
    const planned = plan();

    expect(planned?.key).toMatch(
      /^projects\/night-runner\/20261021020304-[a-z0-9]{8}\.png$/u
    );
    expect(planned).toMatchObject({
      contentType: "image/png",
      prefix: "projects",
    });
  });

  it("takes the extension from the MIME type, not from the caller", () => {
    expect(
      plan({ contentType: "image/jpeg" })?.key.endsWith(".jpg")
    ).toBeTruthy();
    expect(
      plan({ contentType: "IMAGE/WEBP" })?.key.endsWith(".webp")
    ).toBeTruthy();
  });

  it.each(["image/svg+xml", "application/pdf", "text/html", ""])(
    "refuses %j",
    (contentType) => {
      expect(plan({ contentType })).toBeNull();
    }
  );

  it("falls back to a general scope when none is given", () => {
    expect(plan({ scope: undefined })?.key).toContain("/general/");
  });

  it("sanitizes a scope with spaces, uppercase and separators", () => {
    const key = plan({ scope: "../../Night Runner v2" })?.key ?? "";

    expect(key.startsWith("projects/")).toBeTruthy();
    expect(key).not.toContain("..");
    expect(key.split("/")[1]).toBe("night-runner-v2");
  });

  it("keeps the key inside the requested prefix", () => {
    for (const prefix of UPLOAD_PREFIXES) {
      expect(plan({ prefix })?.key.startsWith(`${prefix}/`)).toBeTruthy();
    }
  });

  it("states the limits the form shows", () => {
    expect(UPLOAD_MAX_BYTES).toBe(10 * 1024 * 1024);
    expect(ALLOWED_MIME_TYPES).toStrictEqual([
      "image/avif",
      "image/gif",
      "image/jpeg",
      "image/png",
      "image/webp",
    ]);
  });
});
