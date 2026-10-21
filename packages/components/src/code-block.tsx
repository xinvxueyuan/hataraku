"use client";

import { useRef, useState } from "react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { Check, Copy } from "@hataraku/ui/icons";

/**
 * A highlighted code block with copy-to-clipboard.
 *
 * The pre element and its Shiki-highlighted children are rendered exactly as the pipeline emitted
 * them; this wrapper only adds a button that reads `textContent`. The result of a copy is announced
 * twice on purpose: the button's accessible name changes, and a live region says the code was
 * copied, so a screen reader hears the confirmation whether or not it is focused on the button.
 *
 * Labels default to the site's language but are overridable: the package must not own copy.
 */
interface CodeBlockLabels {
  copied?: string;
  copiedStatus?: string;
  copy?: string;
}

interface CodeBlockProps extends ComponentPropsWithoutRef<"pre"> {
  children?: ReactNode;
  labels?: CodeBlockLabels;
}

const DEFAULT_LABELS = {
  copied: "已复制代码",
  copiedStatus: "代码已复制",
  copy: "复制代码",
} as const;

export const CodeBlock = ({ children, labels, ...props }: CodeBlockProps) => {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  const copyLabel = labels?.copy ?? DEFAULT_LABELS.copy;
  const copiedLabel = labels?.copied ?? DEFAULT_LABELS.copied;
  const copiedStatus = labels?.copiedStatus ?? DEFAULT_LABELS.copiedStatus;

  const copy = async () => {
    const text = preRef.current?.textContent ?? "";

    if (text === "") {
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
      }, 1600);
    } catch {
      // The clipboard can be denied (permissions, insecure context); leave the button silent
      // rather than claiming a copy that did not happen.
    }
  };

  return (
    <div className="group relative" data-slot="code-block">
      <button
        aria-label={copied ? copiedLabel : copyLabel}
        className="border-border bg-background text-muted-foreground hover:text-foreground focus-visible:ring-ring focus-visible:ring-offset-background absolute top-2 right-2 z-10 inline-flex size-8 items-center justify-center rounded-md border opacity-80 shadow-sm transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        onClick={() => {
          void copy();
        }}
        type="button"
      >
        {copied ? (
          <Check aria-hidden="true" className="size-4" />
        ) : (
          <Copy aria-hidden="true" className="size-4" />
        )}
      </button>
      <pre ref={preRef} {...props}>
        {children}
      </pre>
      <output aria-live="polite" className="sr-only">
        {copied ? copiedStatus : ""}
      </output>
    </div>
  );
};
