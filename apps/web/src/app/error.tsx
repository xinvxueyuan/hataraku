"use client";

import Link from "next/link";

import { Button } from "@hataraku/ui/components/button";

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  /** Re-fetches and re-renders the failed segment; present in this Next version. */
  retry?: () => void;
  /** Clears the error state without re-fetching; the older sibling of `retry`. */
  reset?: () => void;
}

/**
 * The root error boundary.
 *
 * It sits below the root layout, so the header and footer stay and the site keeps its frame when a
 * page throws. Next redacts a production error message and keeps only the digest, which is also the
 * key its server log line carries — so the digest is shown verbatim in small type, and the message
 * (which a reader cannot act on) is left out.
 *
 * `error` is `unknown` on purpose: a value thrown in a client component arrives as-is, while one
 * forwarded from a server component arrives as an `Error`. Reading `digest` therefore starts from a
 * narrowing check instead of trusting the type.
 */

const ErrorBoundary = ({ error, reset, retry }: ErrorBoundaryProps) => {
  const digest = error.digest ?? null;

  const recover = retry ?? reset;

  return (
    <div
      className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-16"
      data-slot="error-boundary"
    >
      <p className="text-muted-foreground font-mono text-sm tracking-widest">
        出错了
      </p>

      <h1 className="text-3xl font-semibold tracking-tight">这一页出错了</h1>

      <p className="text-muted-foreground">
        页面渲染中断了。可以重试一次；要是它一直失败，回首页换个入口也读得到内容。
      </p>

      <div className="flex flex-wrap items-center gap-3">
        {recover === undefined ? null : <Button onClick={recover}>重试</Button>}
        <Button render={<Link href="/" />} variant="outline">
          回首页
        </Button>
      </div>

      {digest === null ? null : (
        <p className="text-muted-foreground font-mono text-xs break-all">
          错误编号：{digest}
        </p>
      )}
    </div>
  );
};

export default ErrorBoundary;
