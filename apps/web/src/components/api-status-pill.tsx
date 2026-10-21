import { serverCall } from "#src/server/query.ts";

/**
 * Data-availability readout, rendered in the footer rather than the reading flow.
 *
 * It used to sit under the home page's tagline and stretched to a full-width bar on mobile. The
 * question it answers is still worth showing — an empty list and an unreachable database look the
 * same — but it belongs beside the colophon, not between the tagline and the newest article. The
 * frozen e2e suite asserts the "Connected" text is visible on the home page, so the pill keeps
 * that label; the footer placement is the design fix.
 *
 * The probe is one cheap read. A failure is reported rather than thrown — the whole point is to say
 * something when the data layer is unreachable, and a page that 500s on that cannot say anything.
 */
const probeApi = async (): Promise<boolean> => {
  try {
    await serverCall.taxonomy.categories();

    return true;
  } catch {
    return false;
  }
};

export const ApiStatusPill = async () => {
  const connected = await probeApi();

  return (
    <output
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm"
      data-slot="api-status"
    >
      <span
        aria-hidden="true"
        className={
          connected
            ? "bg-success size-2 rounded-full"
            : "bg-destructive size-2 rounded-full"
        }
      />
      <span className="text-muted-foreground">API</span>
      <span className="font-medium">{connected ? "Connected" : "Offline"}</span>
    </output>
  );
};
