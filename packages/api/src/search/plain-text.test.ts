import { describe, expect, it } from "vite-plus/test";

import { markdownToPlainText } from "#src/search/plain-text.ts";

const sample = [
  "## 标题",
  "",
  '**粗体** 与 _斜体_，[链接](https://example.com "Optional Title Here")，![图](a.png)。',
  "",
  "| 列一 | 列二 |",
  "| --- | --- |",
  "| 值 | 值 |",
  "",
  "---",
  "",
  "代码 `inline` 与 ```fenced``` 结束。",
  "",
  "[Google]: http://google.com/",
  "",
  "[Google][] 引用。",
].join("\n");

describe(markdownToPlainText, () => {
  it("keeps prose and removes presentation markup", () => {
    const text = markdownToPlainText(sample);

    for (const needle of [
      "标题",
      "粗体",
      "链接",
      "图",
      "值",
      "Google",
      "inline",
    ]) {
      expect(text).toContain(needle);
    }
  });

  it("leaves no Markdown residue", () => {
    const text = markdownToPlainText(sample);
    const forbidden = ["](", "|", "**", "__", "---", String.fromCodePoint(96)];

    for (const needle of forbidden) {
      expect(text).not.toContain(needle);
    }

    expect(text).not.toMatch(/^#/u);
  });

  it("keeps plain HTML that the renderer shows as text", () => {
    expect(markdownToPlainText("A <b>& 符号")).toBe("A <b>& 符号");
  });

  it("collapses whitespace to one line", () => {
    expect(markdownToPlainText("a\n\n b\tc")).toBe("a b c");
  });

  it("keeps underscores inside code identifiers", () => {
    const text = markdownToPlainText("limit_req_zone 与 _强调_");

    expect(text).toContain("limit_req_zone");
    expect(text).toContain("强调");
    expect(text).not.toContain("_强调_");
  });
});
