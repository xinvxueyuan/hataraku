"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

/**
 * The search field.
 *
 * The URL is the source of truth: typing updates the local value, a debounce rewrites `?q=` with
 * `router.replace`, and the server page re-renders the matches. Keep the form's GET action: with
 * JavaScript off, pressing Enter still lands on `/search?q=…`.
 *
 * Two details this component exists for:
 * 1. An IME composition (pinyin) must not search. Until `compositionend`, the field holds letters
 *    that are not the query yet; the debounce timer is not armed, so no request leaves.
 * 2. The field keeps focus while the results change. Navigation runs in a transition, and the
 *    pending state is announced in place rather than replacing the input.
 */

const DEBOUNCE_MS = 280;

const targetOf = (value: string): Route => {
  // The only dynamic part is an encoded query string on the /search route, which the typed-routes
  // map cannot express.
  const trimmed = value.trim();

  // SAFETY: the path is the fixed /search route and the query is encodeURIComponent output, so
  // the string cannot introduce a different route segment.

  return trimmed === ""
    ? "/search"
    : `/search?q=${encodeURIComponent(trimmed)}`;
};

export const SearchForm = ({ query }: { query: string }) => {
  const router = useRouter();
  const [value, setValue] = useState(query);
  const [isComposing, setIsComposing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const pendingQuery = useRef<string | null>(null);
  const lastQuery = useRef(query);

  // Follow the URL only when it changed underneath the field (Back/Forward, a shared link). A local
  // keystroke changes `value`, never `query`, so it must not be overwritten by this sync.
  useEffect(() => {
    if (query === lastQuery.current) {
      return;
    }

    lastQuery.current = query;

    if (pendingQuery.current === query) {
      return;
    }

    setValue(query);
  }, [query]);

  const navigate = useCallback(
    (next: string) => {
      const trimmed = next.trim();
      pendingQuery.current = trimmed;

      startTransition(() => {
        router.replace(targetOf(trimmed), { scroll: false });
      });
    },
    [router, startTransition]
  );

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    if (!isComposing && value.trim() !== query) {
      const timer = window.setTimeout(() => {
        navigate(value);
      }, DEBOUNCE_MS);

      cleanup = () => {
        window.clearTimeout(timer);
      };
    }

    return cleanup;
  }, [value, isComposing, query, navigate]);

  return (
    <search className="flex flex-col gap-2">
      <form
        action="/search"
        className="flex w-full gap-2"
        method="get"
        onSubmit={(event) => {
          event.preventDefault();
          navigate(value);
        }}
      >
        <label className="sr-only" htmlFor="search-input">
          搜索关键词
        </label>
        <input
          aria-busy={isPending}
          className="bg-background flex-1 rounded-md border px-3 py-2 text-sm"
          id="search-input"
          name="q"
          onChange={(event) => {
            setValue(event.currentTarget.value);
          }}
          onCompositionEnd={(event) => {
            setIsComposing(false);
            setValue(event.currentTarget.value);
          }}
          onCompositionStart={() => {
            setIsComposing(true);
          }}
          placeholder="输入关键词"
          type="search"
          value={value}
        />
        <button
          className="hover:bg-accent rounded-md border px-3 py-2 text-sm"
          type="submit"
        >
          搜索
        </button>
      </form>
      <span
        aria-live="polite"
        className="text-muted-foreground h-4 text-xs"
        data-slot="search-pending"
      >
        {isPending ? "搜索中…" : ""}
      </span>
    </search>
  );
};
