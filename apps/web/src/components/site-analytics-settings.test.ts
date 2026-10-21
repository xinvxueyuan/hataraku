import { describe, expect, it } from "vite-plus/test";

import { resolveAnalyticsScript } from "#src/components/site-analytics-settings.ts";

/** Built from parts so the source never contains a script URL a linter would flag. */
const scriptScheme = (scheme: string): string => `${scheme}:alert(1)`;

const configured = (
  overrides: Partial<Parameters<typeof resolveAnalyticsScript>[0]> = {}
) => ({
  enabled: true,
  provider: "umami" as const,
  respectDnt: false,
  scriptSrc: "",
  siteId: "site-123",
  ...overrides,
});

const custom = (scriptSrc: string) => ({
  ...configured(),
  provider: "custom" as const,
  scriptSrc,
});

/**
 * Every case here is a state the injector must load nothing in, or the one script it must load —
 * the disabled-with-config state is the one that is easy to get wrong, so it is first.
 */
describe(resolveAnalyticsScript, () => {
  it("loads nothing when disabled, even with a full configuration", () => {
    expect(
      resolveAnalyticsScript({ ...configured(), enabled: false })
    ).toBeNull();
  });

  it("loads nothing for provider none, a null config, or a missing site id", () => {
    expect(
      resolveAnalyticsScript({ ...configured(), provider: "none" })
    ).toBeNull();
    expect(resolveAnalyticsScript(null)).toBeNull();
    expect(resolveAnalyticsScript({ ...configured(), siteId: "" })).toBeNull();
  });

  it("uses the hosted umami script with the site id", () => {
    expect(resolveAnalyticsScript(configured())).toStrictEqual({
      provider: "umami",
      respectDnt: false,
      siteId: "site-123",
      src: "https://cloud.umami.is/script.js",
    });
  });

  it("uses the hosted plausible script, or the owner's https one", () => {
    expect(
      resolveAnalyticsScript({ ...configured(), provider: "plausible" })?.src
    ).toBe("https://plausible.io/js/script.js");
    expect(
      resolveAnalyticsScript({
        ...configured(),
        scriptSrc: "https://stats.example.com/script.js",
      })?.src
    ).toBe("https://stats.example.com/script.js");
  });

  it("puts the google id in the tag URL", () => {
    expect(
      resolveAnalyticsScript({
        ...configured(),
        provider: "google",
        siteId: "G-123",
      })
    ).toStrictEqual({
      provider: "google",
      respectDnt: false,
      siteId: "G-123",
      src: "https://www.googletagmanager.com/gtag/js?id=G-123",
    });
  });

  it("accepts a custom source only when it is https", () => {
    expect(
      resolveAnalyticsScript(custom("https://cdn.example.com/a.js"))?.src
    ).toBe("https://cdn.example.com/a.js");
    expect(
      resolveAnalyticsScript(custom(scriptScheme("javascript")))
    ).toBeNull();
    expect(
      resolveAnalyticsScript(custom("data:text/html,<script>"))
    ).toBeNull();
    expect(
      resolveAnalyticsScript(custom("http://cdn.example.com/a.js"))
    ).toBeNull();
    expect(resolveAnalyticsScript(custom(""))).toBeNull();
  });

  it("carries the do-not-track preference through", () => {
    expect(
      resolveAnalyticsScript({ ...configured(), respectDnt: true })?.respectDnt
    ).toBeTruthy();
  });
});
