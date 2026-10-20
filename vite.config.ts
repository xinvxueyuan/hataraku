import oxfmt from "ultracite/oxfmt";
import antiSlop from "ultracite/oxlint/anti-slop";
import core from "ultracite/oxlint/core";
import next from "ultracite/oxlint/next";
import react from "ultracite/oxlint/react";
import shadcn from "ultracite/oxlint/shadcn";
import vitest from "ultracite/oxlint/vitest";
import { defineConfig, loadEnv } from "vite-plus";

const generatedFiles = [
  "**/.next/**",
  "**/.velite/**",
  "**/.next-test-*/**",
  "**/next-env.d.ts",
  "packages/db/src/migrations/**",
  "apps/mobile/uniwind-types.d.ts",
];

const vendoredFiles = ["packages/ui/src/components/**"];

// Verification artifacts: probe scripts and captured evidence under artifacts/. They are run by
// hand to prove a behaviour and are never imported by the product, so they are evidence rather than
// source. Linting them as product code turns a throwaway probe into a build blocker.
const verificationArtifacts = ["artifacts/**"];

export default defineConfig({
  fmt: {
    ...oxfmt,
    ignorePatterns: [
      ...(oxfmt.ignorePatterns ?? []),
      ...generatedFiles,
      ...verificationArtifacts,
    ],
    proseWrap: "preserve",
    sortImports: {
      customGroups: [
        {
          elementNamePattern: ["@hataraku/**"],
          groupName: "workspace",
        },
      ],
      groups: [
        "builtin",
        "external",
        "workspace",
        ["internal", "subpath"],
        ["parent", "sibling", "index"],
        "style",
        "unknown",
      ],
      ignoreCase: true,
      newlinesBetween: true,
      order: "asc",
    },
  },
  lint: {
    extends: [core, react, next, shadcn, vitest, antiSlop],
    ignorePatterns: [
      ...(core.ignorePatterns ?? []),
      ...generatedFiles,
      ...vendoredFiles,
      ...verificationArtifacts,
    ],
    jsPlugins: [
      // Knip reads this string. A spread of `shadcn.jsPlugins` is invisible to it.
      { name: "shadcn", specifier: "@shadcn/lint" },
      { name: "vite-plus", specifier: "vite-plus/oxlint-plugin" },
    ],
    options: { typeAware: true, typeCheck: true },
    overrides: [
      {
        // Hono middleware awaits `next()`, which is not a Node.js error-first callback.
        files: ["apps/server/src/**"],
        rules: { "node/callback-return": "off" },
      },
      {
        files: ["apps/mobile/**"],
        rules: {
          "react/style-prop-object": ["error", { allow: ["StatusBar"] }],
          "shadcn/no-restyle": "off",
        },
      },
      {
        // Better Auth documents its lifecycle hooks as Promise-returning functions whose bodies
        // often await nothing (databaseHooks.user.create.before only validates the incoming user).
        // The library's signature is the idiom here, so `async` stays and require-await steps aside.
        files: ["packages/auth/src/index.ts"],
        rules: { "require-await": "off" },
      },
    ],
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
    },
  },
  staged: {
    "*": "vp check --fix",
  },
  test: {
    projects: [
      {
        test: {
          env: loadEnv("test", `${import.meta.dirname}/apps/server`, ""),
          include: ["packages/api/tests/integration/**/*.test.ts"],
          name: "integration",
        },
      },
      {
        test: {
          include: [
            "apps/web/src/**/*.test.ts",
            "apps/server/src/**/*.test.ts",
            "apps/mobile/src/**/*.test.ts",
            "packages/*/src/**/*.test.ts",
          ],
          name: "unit",
        },
      },
    ],
  },
});
