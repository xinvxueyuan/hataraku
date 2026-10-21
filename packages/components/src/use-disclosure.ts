"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SyntheticEvent } from "react";

/**
 * One source of truth for a controlled disclosure.
 *
 * The native `<details>` handles click, Enter and Space, but it does not close when the reader
 * clicks elsewhere; an uncontrolled element would need a separate patch for each closing route.
 * This hook makes the element controlled and keeps the closing paths in one place:
 *
 * - a `pointerdown` outside the element (not `click`: a drag that starts inside and ends outside
 *   should not be read as a dismissal),
 * - Escape, which also returns focus to the summary,
 * - a link activation inside the panel (via `close`, for a same-route destination),
 * - a route change, which the owning component handles by keying the disclosure on the current
 *   route so its state starts closed on the next page.
 *
 * The document listeners exist only while the panel is open and are removed symmetrically.
 */
interface Disclosure {
  close: () => void;
  detailsRef: React.RefObject<HTMLDetailsElement | null>;
  onToggle: (event: SyntheticEvent<HTMLDetailsElement>) => void;
  open: boolean;
}

export const useDisclosure = (): Disclosure => {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    if (open) {
      const onPointerDown = (event: PointerEvent) => {
        const details = detailsRef.current;

        if (details === null) {
          return;
        }

        if (event.target instanceof Node && details.contains(event.target)) {
          return;
        }

        setOpen(false);
      };

      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key !== "Escape") {
          return;
        }

        setOpen(false);
        detailsRef.current?.querySelector<HTMLElement>("summary")?.focus();
      };

      document.addEventListener("pointerdown", onPointerDown);
      document.addEventListener("keydown", onKeyDown);

      cleanup = () => {
        document.removeEventListener("pointerdown", onPointerDown);
        document.removeEventListener("keydown", onKeyDown);
      };
    }

    return cleanup;
  }, [open]);

  const onToggle = useCallback((event: SyntheticEvent<HTMLDetailsElement>) => {
    const next = event.currentTarget.open;
    setOpen(next);

    if (next) {
      event.currentTarget.querySelector<HTMLElement>("a[href]")?.focus();
    }
  }, []);

  return { close, detailsRef, onToggle, open };
};
