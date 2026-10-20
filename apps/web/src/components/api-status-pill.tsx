import { serverCall } from "#src/server/query.ts";

/**
 * Data-availability pill for the home page.
 *
 * The web app now serves the API in process, so "Connected" no longer says anything about a separate
 * API process. What the probe does answer is whether a read through the router reaches the database:
 * the page renders either way, and an empty list is otherwise indistinguishable from a broken
 * connection. That is the question a visitor looking at an empty home page actually has.
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
