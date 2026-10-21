"use client";

import { useEffect, useSyncExternalStore } from "react";

import type { AnalyticsSettings } from "#src/components/site-analytics-settings.ts";
import { resolveAnalyticsScript } from "#src/components/site-analytics-settings.ts";

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

/**
 * Analytics is measured on the deployed site, not while someone is editing it: a development or
 * test render would send the author's own pageviews to the owner's provider. The build decides this
 * once, so a dev server (and therefore the e2e stack) never injects, and a production build does.
 */
const INJECT_IN_THIS_BUILD = process.env.NODE_ENV === "production";

/** There is no event for "the browser's DNT header changed", so the subscription is a no-op. */
const subscribeToNothing = () => () => {
  // The browser has no event for a DNT change, so the store never notifies.
};

const readsDoNotTrack = () => navigator.doNotTrack === "1";

/**
 * Until the browser has answered, the tag is treated as if it must not load: rendering it first and
 * withdrawing it afterwards would already have sent the request the visitor asked to avoid.
 */
const assumeDoNotTrackOnServer = () => true;

/**
 * The public site's analytics tag, or nothing.
 *
 * A plain async script element rather than next/script: that component never puts the tag in the
 * server HTML (it emits a preload and a hydration-time loader), while a third-party analytics tag
 * should be part of the document and run whether or not React has hydrated.
 *
 * Two client-side decisions cannot be made on the server: navigator.doNotTrack exists only in the
 * browser, so when the owner asked to respect it the tag mounts only after the browser has answered.
 * With the preference off the tag is part of the server HTML, which is what a third-party script
 * wants anyway.
 */
export const SiteAnalytics = ({
  settings,
}: {
  settings: AnalyticsSettings | null;
}) => {
  const script = INJECT_IN_THIS_BUILD ? resolveAnalyticsScript(settings) : null;

  const doNotTrack = useSyncExternalStore(
    subscribeToNothing,
    readsDoNotTrack,
    assumeDoNotTrackOnServer
  );

  useEffect(() => {
    if (script === null || script.provider !== "google") {
      return;
    }

    const layer = window.dataLayer ?? [];

    layer.push(["js", new Date()], ["config", script.siteId]);
    window.dataLayer = layer;
  }, [script]);

  if (script === null) {
    return null;
  }

  if (script.respectDnt && doNotTrack) {
    return null;
  }

  if (script.provider === "umami") {
    return <script async data-website-id={script.siteId} src={script.src} />;
  }

  if (script.provider === "plausible") {
    return <script async data-domain={script.siteId} src={script.src} />;
  }

  if (script.provider === "custom") {
    return <script async data-site-id={script.siteId} src={script.src} />;
  }

  // Google's tag reads its configuration from the dataLayer; the effect above feeds it.
  return <script async src={script.src} />;
};
