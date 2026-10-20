"use client";

import { UniverSheetsCorePreset } from "@univerjs/preset-sheets-core";
import UniverPresetSheetsCoreZhCN from "@univerjs/preset-sheets-core/locales/zh-CN";
import { createUniver, LocaleType, mergeLocales } from "@univerjs/presets";
import type { ILanguagePack, IWorkbookData } from "@univerjs/presets";
import { useEffect, useRef } from "react";

import "@univerjs/preset-sheets-core/lib/index.css";

/** The sheet a body may embed: a grid of literal strings, never a formula. */
export type SheetRows = readonly (readonly string[])[];

/** One workbook per embed, so two sheets on a page do not share history or selection. */
const SHEET_ID = "sheet1";
const WORKBOOK_ID = "sheet-embed";

/**
 * The preset ships one language pack per locale, already merged across the plugins it installs.
 * `mergeLocales` is still applied because that is the shape `createUniver` documents: a single
 * locale object keyed by every plugin's namespace. Dropping `locales` altogether is not a smaller
 * version of this: the formula engine asks `LocaleService` for a translated name while the UI
 * renders, and an instance with no packs throws `[LocaleService]: Locale not initialized`.
 *
 * The locale module declares its default export as `any`, so it is narrowed here, once.
 */
/** The preset's locale module is an untyped bag of translation keys, so it is checked, not cast. */
const isLanguagePack = (value: unknown): value is ILanguagePack =>
  Object.prototype.toString.call(value) === "[object Object]";

const ZH_CN_LOCALE: ILanguagePack = isLanguagePack(UniverPresetSheetsCoreZhCN)
  ? UniverPresetSheetsCoreZhCN
  : {};

const LOCALES = {
  [LocaleType.ZH_CN]: mergeLocales(ZH_CN_LOCALE),
};

const toCellData = (rows: SheetRows) =>
  Object.fromEntries(
    rows.map((row, rowIndex) => [
      rowIndex,
      Object.fromEntries(
        row.map((value, columnIndex) => [columnIndex, { v: value }])
      ),
    ])
  );

const columnsOf = (rows: SheetRows): number => {
  let columns = 0;

  for (const row of rows) {
    columns = Math.max(columns, row.length);
  }

  return columns;
};

/**
 * One workbook holding the grid as its only sheet.
 *
 * Every field here is load-bearing. `createWorkbook` accepts a partial snapshot, but a sheet
 * without `id`/`rowCount`/`columnCount` inside a workbook without `sheetOrder` is a sheet the
 * skeleton cannot size: the cells are in the model (`getRange("A1").getValue()` answers) while the
 * canvas draws an empty grid with no row or column headers. Cells carry `{ v }` rather than a
 * formula string, so a body cannot smuggle in an expression that the engine would evaluate.
 */
const toWorkbook = (rows: SheetRows): Partial<IWorkbookData> => ({
  id: WORKBOOK_ID,
  name: "Sheet embed",
  sheetOrder: [SHEET_ID],
  sheets: {
    [SHEET_ID]: {
      cellData: toCellData(rows),
      columnCount: Math.max(columnsOf(rows), 1),
      id: SHEET_ID,
      name: "Sheet1",
      rowCount: Math.max(rows.length, 1),
    },
  },
});

/**
 * Creates the editor inside `host` and returns its teardown.
 *
 * The workbook is built from the grid only: no formulas, no imports, no write-back path.
 */
const mount = (host: HTMLElement, rows: SheetRows): (() => void) => {
  const container = document.createElement("div");
  container.style.height = "100%";
  host.append(container);

  const { univer, univerAPI } = createUniver({
    locale: LocaleType.ZH_CN,
    locales: LOCALES,
    presets: [
      UniverSheetsCorePreset({
        container,
        disableAutoFocus: true,
        footer: false,
        header: false,
        toolbar: false,
      }),
    ],
  });

  univerAPI.createWorkbook(toWorkbook(rows));

  return () => {
    // Disposal runs after React finishes the commit that removed the host, so a nested root is
    // never unmounted from inside a React commit.
    queueMicrotask(() => {
      univer.dispose();
      container.remove();
    });
  };
};

/**
 * Mounts Univer Sheets against a detached child container and loads one read-only workbook.
 *
 * This module is the engine: it is only ever reached through `next/dynamic` with `ssr: false`, so
 * neither the editor nor its stylesheet joins the first bundle, and nothing here runs during
 * prerendering. The embed is read-only because the container it renders into is
 * `pointer-events-none` and the workbook is built from values, so there is no write-back path.
 *
 * The effect keys off `rows`: the grid arrives as a prop of a server component, so its identity is
 * stable across client renders and the editor is only rebuilt when the grid itself changes.
 */
export const UniverCanvas = ({ rows }: { rows: SheetRows }) => {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const teardown = host === null ? null : mount(host, rows);

    return () => {
      teardown?.();
    };
  }, [rows]);

  return <div className="h-full w-full" ref={hostRef} />;
};
