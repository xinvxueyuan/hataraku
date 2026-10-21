import { describe, expect, it } from "vite-plus/test";

import { buildPortalModules } from "./portal-modules.ts";
import type { PortalModule } from "./portal-modules.ts";

const moduleOf = (
  key: PortalModule["key"],
  count: number,
  latest: PortalModule["latest"] = null
): PortalModule => ({
  count,
  countUnit: "篇",
  href: `/${key}`,
  key,
  label: key,
  latest,
});

describe(buildPortalModules, () => {
  it("keeps the product order regardless of the input order", () => {
    const modules = buildPortalModules([
      moduleOf("toolbox", 1),
      moduleOf("writing", 2),
      moduleOf("projects", 1),
      moduleOf("docs", 3),
    ]);

    expect(modules.map((module) => module.key)).toStrictEqual([
      "writing",
      "docs",
      "projects",
      "toolbox",
    ]);
  });

  it("hides modules with no content", () => {
    const modules = buildPortalModules([
      moduleOf("writing", 0),
      moduleOf("docs", 2),
      moduleOf("notes", 0),
    ]);

    expect(modules.map((module) => module.key)).toStrictEqual(["docs"]);
  });

  it("keeps a visible module with no latest item", () => {
    const modules = buildPortalModules([moduleOf("albums", 1, null)]);

    expect(modules).toStrictEqual([moduleOf("albums", 1, null)]);
  });
});
