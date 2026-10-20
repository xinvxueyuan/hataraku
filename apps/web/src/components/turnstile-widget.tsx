"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileRenderOptions {
  callback: (token: string) => void;
  "error-callback": () => void;
  "expired-callback": () => void;
  sitekey: string;
  theme: "auto" | "dark" | "light";
}

interface TurnstileApi {
  render: (element: HTMLElement, options: TurnstileRenderOptions) => string;
  reset: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/**
 * The Turnstile site key is public, so it ships to the browser; the matching secret stays on the
 * server. Unset means no widget, which is how the e2e stack runs: `packages/auth` only registers
 * the captcha plugin when the server has a secret, so the two sides agree without a flag.
 */
export const turnstileSiteKey =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

/**
 * Renders the Cloudflare Turnstile widget and reports its token.
 *
 * Explicit rendering, not the `cf-turnstile` class: React mounts the container after the script
 * loads, and the implicit renderer only scans the DOM once, which leaves the widget blank.
 */
export const TurnstileWidget = ({
  onToken,
}: {
  onToken: (token: string) => void;
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const callbackRef = useRef(onToken);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    callbackRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    const container = containerRef.current;

    if (!loaded || container === null || window.turnstile === undefined) {
      return;
    }

    if (widgetIdRef.current !== null) {
      return;
    }

    widgetIdRef.current = window.turnstile.render(container, {
      callback: (token: string) => {
        callbackRef.current(token);
      },
      "error-callback": () => {
        callbackRef.current("");
      },
      "expired-callback": () => {
        callbackRef.current("");
      },
      sitekey: turnstileSiteKey,
      theme: "auto",
    });
  }, [loaded]);

  return (
    <>
      <Script
        onLoad={() => {
          setLoaded(true);
        }}
        src={SCRIPT_SRC}
        strategy="afterInteractive"
      />
      <div ref={containerRef} />
    </>
  );
};
