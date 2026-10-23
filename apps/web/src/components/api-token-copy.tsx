"use client";

import { useState } from "react";

import { Button } from "@hataraku/ui/components/button";
import { Copy } from "@hataraku/ui/icons";

/**
 * Copy a value the owner has to keep themselves. The value never goes into a URL or storage; this
 * button only writes it to the clipboard and reports the outcome next to the control.
 */
export const CopyButton = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => {
  const [outcome, setOutcome] = useState<"idle" | "copied" | "failed">("idle");

  const COPY_LABELS = {
    copied: "已复制",
    failed: "复制失败",
    idle: "复制",
  } as const;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setOutcome("copied");
    } catch {
      setOutcome("failed");
    }
  };

  return (
    <Button
      aria-label={label}
      onClick={() => {
        void copy();
      }}
      size="sm"
      type="button"
      variant="outline"
    >
      <Copy aria-hidden="true" className="size-3.5" />
      {COPY_LABELS[outcome]}
    </Button>
  );
};
