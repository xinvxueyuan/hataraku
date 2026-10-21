/**
 * The portal's presentation model, kept free of server-only imports so its ordering rule is a
 * plain function with a plain test.
 */
type PortalKey =
  | "writing"
  | "docs"
  | "projects"
  | "albums"
  | "notes"
  | "changelog"
  | "toolbox";

interface PortalLatest {
  /** Already formatted for display; null when the module's newest row has no date. */
  date: string | null;
  href: string;
  title: string;
}

export interface PortalModule {
  count: number;
  countUnit: string;
  href: string;
  key: PortalKey;
  label: string;
  latest: PortalLatest | null;
}

/** The order the portal promises, independent of the order the reads return. */
const MODULE_ORDER: readonly PortalKey[] = [
  "writing",
  "docs",
  "projects",
  "albums",
  "notes",
  "changelog",
  "toolbox",
];

/**
 * Keep only modules with content, in the product order.
 *
 * This is the whole presentation rule: a module with nothing in it is not a destination yet, and
 * the order is a design decision rather than an accident of Promise.all.
 */
export const buildPortalModules = (
  input: readonly PortalModule[]
): PortalModule[] =>
  MODULE_ORDER.flatMap((key) => {
    const entry = input.find((candidate) => candidate.key === key);

    return entry === undefined || entry.count === 0 ? [] : [entry];
  });
