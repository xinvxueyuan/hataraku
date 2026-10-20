import { serverCall } from "#src/server/query.ts";

/**
 * Service status pill for the home page.
 *
 * The site had a status indicator before the rewrite, and it earns its place: the page is rendered
 * by a Next server that talks to a separate API process, so "the API answered" is real information
 * for whoever is looking at a page that came back empty.
 *
 * The probe is one cheap read. A failure is reported rather than thrown — the whole point is to say
 * something when the API is unreachable, and a page that 500s on that cannot say anything.
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
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs"
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
