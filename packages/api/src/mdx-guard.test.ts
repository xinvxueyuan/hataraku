import { describe, expect, it } from "vite-plus/test";

import { assertSafeMdx, UnsafeMdxError } from "#src/mdx-guard.ts";

/**
 * The guard is the write-side half of the MDX boundary: a body that carries module syntax or a
 * dynamic-evaluation escape is refused before it is stored, and again before the compiler sees it.
 * Each case below is a body an editor user could otherwise save.
 */
describe(assertSafeMdx, () => {
  it.each([
    ['import secret from "./secret.md"', "import"],
    ["export default () => 1", "export"],
    ['{eval("1 + 1")}', "eval"],
    ['{new Function("return 1")()}', "the Function constructor"],
    ['{require("node:fs")}', "require"],
    ["{process.env.BETTER_AUTH_SECRET}", "process access"],
    ["{globalThis}", "globalThis access"],
    ["<script>alert(1)</script>", "script tags"],
  ])("rejects %j", (source, reason) => {
    expect(() => {
      assertSafeMdx(source);
    }).toThrow(UnsafeMdxError);
    expect(() => {
      assertSafeMdx(source);
    }).toThrow(reason);
  });

  it("leaves ordinary markdown alone", () => {
    const body = [
      "# Title",
      "",
      "A paragraph with **bold**, a [link](https://example.com), and `inline code`.",
      "",
      "| a | b |",
      "| - | - |",
      "| 1 | 2 |",
      "",
      "```ts",
      "const answer = 42;",
      "```",
    ].join("\n");

    expect(() => {
      assertSafeMdx(body);
    }).not.toThrow();
  });

  it.each([
    '```ts\nimport secret from "./secret.md"\n```',
    '~~~js\nconst fs = require("node:fs");\n~~~',
    '  ```\nimport x from "y"\n  ```',
    '    ```\n    import x from "y"\n    ```',
    '````md\n```\nimport inside from "y"\n```\n````',
    '```md\n~~~\nimport inside from "y"\n~~~\n```',
    'Use `require("node:fs")` as an example.',
  ])("ignores module-looking code inside code: %j", (body) => {
    expect(() => {
      assertSafeMdx(body);
    }).not.toThrow();
  });

  it("still rejects require outside code", () => {
    expect(() => {
      assertSafeMdx('require("node:fs")');
    }).toThrow("require is not allowed");
  });

  it("still rejects a script tag outside code", () => {
    expect(() => {
      assertSafeMdx("<script>alert(1)</script>");
    }).toThrow("script tags are not allowed");
  });

  it("does not flag the word important mid-sentence", () => {
    expect(() => {
      assertSafeMdx("This is an important note.");
    }).not.toThrow();
  });
});
