"use client";

import { Check, Copy } from "lucide-react";
import { useRef, useState } from "react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

/**
 * A highlighted code block with copy-to-clipboard.
 *
 * The pre element and its Shiki-highlighted children are rendered exactly as the pipeline emitted
 * them; this wrapper only adds a button that reads `innerText`. The result of a copy is announced
 * twice on purpose: the button's accessible name changes, and a live region says the code was
 * copied, so a screen reader hears the confirmation whether or not it is focused on the button.
 */
interface CodeBlockProps extends ComponentPropsWithoutRef<"pre"> {
  children?: ReactNode;
}

export const CodeBlock = ({ children, ...props }: CodeBlockProps) => {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

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
        aria-label={copied ? "已复制代码" : "复制代码"}
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
        {copied ? "代码已复制" : ""}
      </output>
    </div>
  );
};
