import { createElement as h } from "react";
import { describe, expect, it } from "vite-plus/test";

import { readSheetTable } from "#src/components/sheet-table.ts";

const cell = (tag: "td" | "th", text: string) => h(tag, null, text);

/**
 * The contract: a markdown table inside `<Sheet>` becomes the grid the sheet shows, header row
 * included, and a body with no table is refused rather than rendering an empty canvas. The trees
 * below are what remark-gfm emits for those markdown sources.
 */
describe(readSheetTable, () => {
  it("reads a header and body rows into one grid", () => {
    const tree = [
      "\n",
      h(
        "table",
        null,
        h("thead", null, h("tr", null, cell("th", "阶段"), cell("th", "归属"))),
        h(
          "tbody",
          null,
          h("tr", null, cell("td", "采集"), cell("td", "Velite")),
          h("tr", null, cell("td", "渲染"), cell("td", "renderMdx"))
        )
      ),
      "\n",
    ];

    expect(readSheetTable(tree)).toStrictEqual([
      ["阶段", "归属"],
      ["采集", "Velite"],
      ["渲染", "renderMdx"],
    ]);
  });

  it("takes a table that carries no header row", () => {
    const tree = h(
      "table",
      null,
      h("tbody", null, h("tr", null, cell("td", "1"), cell("td", "2")))
    );

    expect(readSheetTable(tree)).toStrictEqual([["1", "2"]]);
  });

  it("flattens inline markup inside a cell to its text", () => {
    const tree = h(
      "table",
      null,
      h(
        "tbody",
        null,
        h(
          "tr",
          null,
          h(
            "td",
            null,
            h("strong", null, "粗"),
            " 与 ",
            h("code", null, "code")
          )
        )
      )
    );

    expect(readSheetTable(tree)).toStrictEqual([["粗 与 code"]]);
  });

  it("refuses a body with no table", () => {
    expect(() => readSheetTable(["just prose"])).toThrow(/markdown table/u);
  });

  it("refuses a table with no rows", () => {
    expect(() => readSheetTable(h("table", null, h("tbody", null)))).toThrow(
      /no rows/u
    );
  });
});
