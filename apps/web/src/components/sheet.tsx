import type { ReactNode } from "react";

import { SheetCanvas } from "#src/components/sheet-canvas.tsx";
import { readSheetTable } from "#src/components/sheet-table.ts";

interface SheetProps {
  /** The markdown table to show, read into cells by `readSheetTable`. */
  children?: ReactNode;
  /** A line under the grid, the way a table caption reads. */
  label?: string;
}

/**
 * A read-only spreadsheet inside an article body.
 *
 * The wrapper is inert: `pointer-events-none` keeps the grid from taking a click, a focus, or a
 * drag, so the embed renders cells and nothing else. There is no write-back path — the grid is
 * parsed from the body on the server, crosses to the client as values, and never leaves the browser.
 *
 * The body is a markdown table (`children`) rather than a prop, because a compiled body may not
 * carry JavaScript expressions; see `readSheetTable`.
 */
export const Sheet = ({ children, label }: SheetProps) => {
  const rows = readSheetTable(children);

  return (
    <figure className="my-6 flex flex-col gap-2" data-slot="sheet-embed">
      <div
        className="bg-background pointer-events-none h-[420px] w-full overflow-hidden rounded-xl border"
        data-slot="sheet-canvas"
      >
        <SheetCanvas rows={rows} />
      </div>
      {label === undefined ? null : (
        <figcaption className="text-muted-foreground text-sm">
          {label}
        </figcaption>
      )}
    </figure>
  );
};
