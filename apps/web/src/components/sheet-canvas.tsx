"use client";

import dynamic from "next/dynamic";

import type { SheetRows } from "#src/components/univer-canvas.tsx";

/**
 * The editor is loaded on demand and in the browser only: Univer touches `window` and the DOM while
 * it initializes, and the engine plus its stylesheet are far too large to sit in the first bundle of
 * a page that may not contain a sheet.
 */
const UniverCanvas = dynamic(
  async () => {
    const imported = await import("#src/components/univer-canvas.tsx");

    return imported.UniverCanvas;
  },
  {
    loading: () => (
      <div className="bg-muted/40 text-muted-foreground flex h-full w-full items-center justify-center text-sm">
        正在加载表格…
      </div>
    ),
    ssr: false,
  }
);

/** Mounts the editor for a grid of cells. Client-side because the editor is. */
export const SheetCanvas = ({ rows }: { rows: SheetRows }) => (
  <UniverCanvas rows={rows} />
);
