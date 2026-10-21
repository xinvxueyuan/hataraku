/**
 * Copies production content from the old NightStack database into the new hataraku database.
 *
 * Run:  node scripts/migrate-content.ts [--dry-run] [--report <path>]
 *
 * Connection strings come from the environment and are never printed: the run names the host and
 * database only, which is enough to tell the two endpoints apart without putting a credential on
 * screen.
 *
 *   SOURCE_DATABASE_URL  read-only, the old NightStack database
 *   TARGET_DATABASE_URL  the new hataraku database
 *
 * ## Strategy: upsert on the primary key
 *
 * Chosen over truncate-and-copy because it is idempotent *and* non-destructive: a second run
 * rewrites the same rows instead of duplicating them, and it never deletes a row that exists only
 * in the target. The trade-off is that a row deleted at the source survives in the target, so the
 * reconciliation step reports the difference instead of hiding it: for a content move, a reported
 * mismatch is more useful than a silent wipe.
 *
 * ## Why some values travel as text
 *
 * A timestamptz holds microseconds and a JavaScript Date holds milliseconds, so reading one
 * natively and writing it back silently truncates the sub-millisecond digits. A date is parsed as a
 * JavaScript Date at local midnight, which can shift the day across time zones. Both travel as
 * PostgreSQL's own text form and are cast back server-side, which keeps the value exact. Every
 * other column stays native, because the driver mangles some of them the other way round: a
 * JavaScript string bound to ::boolean lands as false whatever it says.
 *
 */

import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

/** A value that can travel as a bound parameter or come back in a result row. */
type SqlValue =
  | boolean
  | number
  | null
  | string
  | SqlValue[]
  | { [key: string]: SqlValue };

/** One result row, keyed by the column aliases the statement selects. */
type SqlRow = Record<string, SqlValue>;

/** The subset of the postgres.js client this script calls. */
interface SqlClient {
  end: () => Promise<void>;
  unsafe: (query: string, parameters?: SqlValue[]) => Promise<SqlRow[]>;
}

type PostgresFactory = (url: string, options: { max: number }) => SqlClient;

interface Column {
  name: string;
  type: string;
}

interface TablePlan {
  columns: Column[];
  name: string;
  primaryKey: string[];
}

interface CopyRow {
  after: number;
  before: number;
  source: number;
  table: string;
}

interface RowComparison {
  differing: string[];
  extra: string[];
  missing: string[];
}

interface ReconcileResult {
  contentMatch: boolean;
  countsMatch: boolean;
  differing: string[];
  extra: string[];
  missing: string[];
  source: number;
  table: string;
  target: number;
}

interface ReferenceCheck {
  description: string;
  query: string;
}

interface ReferenceResult {
  description: string;
  sourceOrphans: number;
  targetOrphans: number;
}

interface UntouchedResult {
  after: number;
  before: number;
  table: string;
}

interface ClearedSlugResult {
  cleared: number;
  table: string;
}

interface Endpoint {
  database: string;
  host: string;
}

interface Options {
  dryRun: boolean;
  reportPath: string | undefined;
}

interface Report {
  copies: CopyRow[];
  dryRun: boolean;
  failures: string[];
  generatedAt: string;
  clearedSlugs: ClearedSlugResult[];
  source: Endpoint;
  tables: ReconcileResult[];
  target: Endpoint;
  untouched: UntouchedResult[];
}

const require = createRequire(
  new URL("../packages/db/package.json", import.meta.url)
);

const isPostgresFactory = (value: unknown): value is PostgresFactory =>
  typeof value === "function";

const loadedDriver: unknown = require("postgres");

if (!isPostgresFactory(loadedDriver)) {
  throw new Error("postgres did not load a client factory");
}

/** The driver @hataraku/db depends on, narrowed above to the subset of its client this script calls. */
const postgres = loadedDriver;

/**
 * One connection per client. The session settings that make timestamps render identically on both
 * servers are set per connection, so a pool would let a digest query run under a different session
 * than the one it was configured on.
 */
const MAX_CONNECTIONS = 1;

const BATCH_SIZE = 200;

/** Tables whose rows this script must never write. Counted before and after as evidence. */
const UNTOUCHED_TABLES = ["login_attempts", "todos"] as const;

/**
 * Write order. Only one foreign key exists among these tables (album_photos.album_id -> albums.id),
 * so albums must precede album_photos. posts.category_id is a plain column with no constraint, and
 * post_tags carries none either; the order below keeps those logical references satisfiable anyway.
 *
 * login_attempts is deliberately absent: it is short-lived audit data, not content.
 */
const TABLES = [
  "categories",
  "posts",
  "tags",
  "post_tags",
  "projects",
  "micro_posts",
  "changelog_entries",
  "tools",
  "friends",
  "skills",
  "albums",
  "album_photos",
  "devices",
  "diary_entries",
  "timeline_entries",
  "site_profile",
] as const;

/** References the schema leaves unconstrained, checked so a copy cannot silently break them. */
const REFERENCE_CHECKS: ReferenceCheck[] = [
  {
    description: "post_tags.post_id -> posts.id",
    query:
      "select count(*)::int as n from post_tags pt where not exists (select 1 from posts p where p.id = pt.post_id)",
  },
  {
    description: "post_tags.tag_id -> tags.id",
    query:
      "select count(*)::int as n from post_tags pt where not exists (select 1 from tags t where t.id = pt.tag_id)",
  },
  {
    description: "album_photos.album_id -> albums.id",
    query:
      "select count(*)::int as n from album_photos ap where not exists (select 1 from albums a where a.id = ap.album_id)",
  },
  {
    description: "posts.category_id -> categories.id",
    query:
      "select count(*)::int as n from posts p where p.category_id is not null and not exists (select 1 from categories c where c.id = p.category_id)",
  },
];

const TEXT_TRANSPORT_TYPES = new Set([
  "date",
  "timestamp with time zone",
  "timestamp without time zone",
]);

const readUrl = (name: string): string => {
  const value = process.env[name];

  if (value === undefined || value === "") {
    throw new Error(`${name} is not set`);
  }

  return value;
};

/** Host, port and database only: enough to identify an endpoint, never a credential. */
const describeEndpoint = (url: string): Endpoint => {
  const parsed = new URL(url);
  const port = parsed.port === "" ? "" : `:${parsed.port}`;

  return {
    database: parsed.pathname.slice(1),
    host: `${parsed.hostname}${port}`,
  };
};

const endpointText = (endpoint: Endpoint): string =>
  `${endpoint.host}/${endpoint.database}`;

const readOptions = (argv: string[]): Options => {
  const reportIndex = argv.indexOf("--report");
  const reportPath = reportIndex === -1 ? undefined : argv[reportIndex + 1];

  if (reportIndex !== -1 && reportPath === undefined) {
    throw new Error("--report needs a path");
  }

  return { dryRun: argv.includes("--dry-run"), reportPath };
};

const isText = (value: SqlValue | undefined): value is string =>
  typeof value === "string";

const isCount = (value: SqlValue | undefined): value is number =>
  typeof value === "number";

const firstRow = (rows: SqlRow[]): SqlRow => {
  const [row] = rows;

  if (row === undefined) {
    throw new Error("the query returned no rows");
  }

  return row;
};

const textOf = (row: SqlRow, column: string): string => {
  const value = row[column];

  if (!isText(value)) {
    throw new Error(`the query returned no text for ${column}`);
  }

  return value;
};

const pad = (value: number): string => String(value).padStart(5, " ");

const statusText = (ok: boolean): string => (ok ? "OK  " : "DIFF");

/** Both servers must render timestamps the same way, or the content digests below would differ. */
const prepareSession = async (sql: SqlClient): Promise<void> => {
  await sql.unsafe("set time zone 'UTC'");
  await sql.unsafe("set datestyle = 'ISO, YMD'");
};

const introspect = async (
  sql: SqlClient,
  table: string
): Promise<TablePlan> => {
  const columns = await sql.unsafe(
    `select a.attname as name,
            format_type(a.atttypid, a.atttypmod) as type
       from pg_attribute a
      where a.attrelid = $1::regclass
        and a.attnum > 0
        and not a.attisdropped
      order by a.attnum`,
    [`public.${table}`]
  );

  const primaryKey = await sql.unsafe(
    `select a.attname as name
       from pg_index i
       join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
      where i.indrelid = $1::regclass
        and i.indisprimary
      order by array_position(i.indkey, a.attnum)`,
    [`public.${table}`]
  );

  return {
    columns: columns.map((row): Column => ({
      name: textOf(row, "name"),
      type: textOf(row, "type"),
    })),
    name: table,
    primaryKey: primaryKey.map((row): string => textOf(row, "name")),
  };
};

const countOf = async (sql: SqlClient, table: string): Promise<number> => {
  const value = firstRow(
    await sql.unsafe(`select count(*)::int as n from "${table}"`)
  ).n;

  if (!isCount(value)) {
    throw new Error(`the count query for ${table} returned no integer`);
  }

  return value;
};

const countTables = async (
  sql: SqlClient,
  tables: readonly string[]
): Promise<Map<string, number>> =>
  new Map(
    await Promise.all(
      tables.map(async (table): Promise<[string, number]> => [
        table,
        await countOf(sql, table),
      ])
    )
  );

const columnExpression = (column: Column): string => {
  const quoted = `"${column.name}"`;

  return TEXT_TRANSPORT_TYPES.has(column.type)
    ? `${quoted}::text as ${quoted}`
    : quoted;
};

const parameterExpression = (column: Column, position: number): string =>
  TEXT_TRANSPORT_TYPES.has(column.type)
    ? `$${position}::text::${column.type}`
    : `$${position}::${column.type}`;

const selectAll = (plan: TablePlan): string =>
  `select ${plan.columns.map((column) => columnExpression(column)).join(", ")} from "${plan.name}"`;

const buildInsert = (plan: TablePlan, rowCount: number): string => {
  const columns = plan.columns.map((column) => `"${column.name}"`).join(", ");

  const tuples: string[] = [];

  for (let row = 0; row < rowCount; row += 1) {
    const parameters = plan.columns.map((column, index) =>
      parameterExpression(column, row * plan.columns.length + index + 1)
    );

    tuples.push(`(${parameters.join(", ")})`);
  }

  const updatable = plan.columns.filter(
    (column) => !plan.primaryKey.includes(column.name)
  );

  const conflict =
    updatable.length === 0
      ? "do nothing"
      : `do update set ${updatable
          .map((column) => `"${column.name}" = excluded."${column.name}"`)
          .join(", ")}`;

  const conflictTarget = plan.primaryKey
    .map((column) => `"${column}"`)
    .join(", ");

  return `insert into "${plan.name}" (${columns}) values ${tuples.join(
    ", "
  )} on conflict (${conflictTarget}) ${conflict}`;
};

const copyTable = async (
  source: SqlClient,
  target: SqlClient,
  plan: TablePlan
): Promise<number> => {
  const rows = await source.unsafe(selectAll(plan));
  const batches: SqlRow[][] = [];

  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    batches.push(rows.slice(offset, offset + BATCH_SIZE));
  }

  await Promise.all(
    batches.map(async (batch) => {
      const parameters = batch.flatMap((row) =>
        plan.columns.map(
          (column) =>
            row[column.name] ?? (column.name === "slug_only" ? false : null)
        )
      );

      await target.unsafe(buildInsert(plan, batch.length), parameters);
    })
  );

  return rows.length;
};

const copyAll = async (
  source: SqlClient,
  target: SqlClient,
  plans: TablePlan[]
): Promise<CopyRow[]> => {
  const results: CopyRow[] = [];

  /* oxlint-disable no-await-in-loop -- album_photos carries a foreign key to albums, so a table cannot start before the table it depends on has finished */
  for (const plan of plans) {
    const before = await countOf(target, plan.name);
    const sourceRows = await copyTable(source, target, plan);
    const after = await countOf(target, plan.name);

    results.push({ after, before, source: sourceRows, table: plan.name });
  }
  /* oxlint-enable no-await-in-loop */

  return results;
};

const primaryKeyOrder = (plan: TablePlan): string =>
  plan.primaryKey.map((column) => `x."${column}"::text`).join(", ");

/**
 * A digest of every copied row, so reconciliation compares values and not only counts. Row counts
 * alone let a column drift — booleans flipping to false, timestamps losing microseconds — while
 * still reporting OK.
 *
 * The projection is explicit rather than to_jsonb(t): both schemas hold the same columns in a
 * different ordinal order (drizzle-kit emits them alphabetically), and the digest must describe the
 * columns this script copies, not whatever else the target schema has grown.
 */
const tableDigest = async (
  sql: SqlClient,
  plan: TablePlan
): Promise<string> => {
  const rows = await sql.unsafe(
    `select md5(coalesce(string_agg(md5(to_jsonb(x)::text), '' order by ${primaryKeyOrder(
      plan
    )}), '')) as digest
       from (select ${plan.columns
         .map((column) => `"${column.name}"`)
         .join(", ")} from "${plan.name}") x`
  );

  return textOf(firstRow(rows), "digest");
};

const rowDigests = async (
  sql: SqlClient,
  plan: TablePlan
): Promise<Map<string, string>> => {
  const key = plan.primaryKey
    .map((column) => `x."${column}"::text`)
    .join(" || '|' || ");

  const rows = await sql.unsafe(
    `select ${key} as key, md5(to_jsonb(x)::text) as digest
       from (select ${plan.columns
         .map((column) => `"${column.name}"`)
         .join(", ")} from "${plan.name}") x`
  );

  const entries: [string, string][] = rows.map((row): [string, string] => [
    textOf(row, "key"),
    textOf(row, "digest"),
  ]);

  return new Map(entries);
};

const compareRows = (
  source: Map<string, string>,
  target: Map<string, string>
): RowComparison => {
  const differing: string[] = [];
  const missing: string[] = [];

  for (const [key, digest] of source) {
    const other = target.get(key);

    if (other === undefined) {
      missing.push(key);
    } else if (other !== digest) {
      differing.push(key);
    }
  }

  const extra = [...target.keys()].filter((key) => !source.has(key));

  return { differing, extra, missing };
};

const reconcileTable = async (
  source: SqlClient,
  target: SqlClient,
  plan: TablePlan
): Promise<ReconcileResult> => {
  const sourceRows = await countOf(source, plan.name);
  const targetRows = await countOf(target, plan.name);
  const sourceDigest = await tableDigest(source, plan);
  const targetDigest = await tableDigest(target, plan);
  const contentMatch = sourceDigest === targetDigest;

  let comparison: RowComparison = { differing: [], extra: [], missing: [] };

  if (!contentMatch) {
    comparison = compareRows(
      await rowDigests(source, plan),
      await rowDigests(target, plan)
    );
  }

  return {
    contentMatch,
    countsMatch: sourceRows === targetRows,
    differing: comparison.differing,
    extra: comparison.extra,
    missing: comparison.missing,
    source: sourceRows,
    table: plan.name,
    target: targetRows,
  };
};

const reconcileAll = async (
  source: SqlClient,
  target: SqlClient,
  plans: TablePlan[],
  failures: string[]
): Promise<ReconcileResult[]> => {
  const results = await Promise.all(
    plans.map(async (plan) => await reconcileTable(source, target, plan))
  );

  for (const result of results) {
    if (!result.countsMatch) {
      failures.push(
        `${result.table}: source=${result.source} target=${result.target} rows`
      );
    }

    if (!result.contentMatch) {
      failures.push(`${result.table}: content digest differs`);
    }
  }

  return results;
};

const countOrphans = async (sql: SqlClient, query: string): Promise<number> => {
  const value = firstRow(await sql.unsafe(query)).n;

  if (!isCount(value)) {
    throw new Error("the orphan query returned no integer");
  }

  return value;
};

const collectReferences = async (
  source: SqlClient,
  target: SqlClient
): Promise<ReferenceResult[]> =>
  await Promise.all(
    REFERENCE_CHECKS.map(async (check): Promise<ReferenceResult> => ({
      description: check.description,
      sourceOrphans: await countOrphans(source, check.query),
      targetOrphans: await countOrphans(target, check.query),
    }))
  );

/**
 * Clears aliases after the content copy. The public address model is id-first: an existing slug is
 * an opt-in alias, so a migrated row must not keep the old site's slug as if the author had chosen it.
 */
const clearSlugs = async (target: SqlClient): Promise<ClearedSlugResult[]> =>
  await Promise.all(
    ["posts", "albums"].map(async (table): Promise<ClearedSlugResult> => {
      const [row] = await target.unsafe(
        `with cleared as (update "${table}" set slug = null where slug is not null returning 1) select count(*)::int as n from cleared`
      );

      const cleared = row?.n;

      if (!isCount(cleared)) {
        throw new Error(`could not count cleared slugs in ${table}`);
      }

      return { cleared, table };
    })
  );

const printClearedSlugs = (results: ClearedSlugResult[]): void => {
  for (const result of results) {
    console.log(`cleared ${result.cleared} slug(s) from ${result.table}`);
  }
};

const untouchedResults = (
  before: Map<string, number>,
  after: Map<string, number>
): UntouchedResult[] => {
  const results: UntouchedResult[] = [];

  for (const table of UNTOUCHED_TABLES) {
    const start = before.get(table);
    const end = after.get(table);

    if (start === undefined || end === undefined) {
      throw new Error(`could not count ${table}`);
    }

    results.push({ after: end, before: start, table });
  }

  return results;
};

const writeReport = async (
  reportPath: string | undefined,
  report: Report
): Promise<void> => {
  if (reportPath === undefined) {
    return;
  }

  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf-8");
  console.log(`\nreport: ${reportPath}`);
};

const printCounts = (counts: Map<string, number>): void => {
  for (const table of TABLES) {
    console.log(
      `${table.padEnd(20)} source=${pad(counts.get(table) ?? 0)} (dry run: nothing written)`
    );
  }
};

const printCopies = (copies: CopyRow[]): void => {
  for (const copy of copies) {
    console.log(
      `${copy.table.padEnd(20)} source=${pad(copy.source)} target_before=${pad(
        copy.before
      )} target_after=${pad(copy.after)}`
    );
  }
};

const printRowSamples = (label: string, keys: string[]): void => {
  if (keys.length === 0) {
    return;
  }

  console.log(`  ${label} ${keys.length} row(s), first few:`);

  for (const key of keys.slice(0, 5)) {
    console.log(`    ${key}`);
  }
};

const printReconcile = (results: ReconcileResult[]): void => {
  for (const result of results) {
    const ok = result.countsMatch && result.contentMatch;

    console.log(
      `${statusText(ok)} ${result.table.padEnd(20)} rows ${pad(
        result.source
      )}/${pad(result.target)}  content ${result.contentMatch ? "identical" : "DIFFERS"}`
    );
    printRowSamples("differing", result.differing);
    printRowSamples("missing", result.missing);
    printRowSamples("extra", result.extra);
  }
};

const printReferences = (
  results: ReferenceResult[],
  failures: string[]
): void => {
  for (const result of results) {
    const ok = result.targetOrphans <= result.sourceOrphans;

    console.log(
      `${statusText(ok)} ${result.description.padEnd(36)} source=${pad(
        result.sourceOrphans
      )} target=${pad(result.targetOrphans)}`
    );

    if (!ok) {
      failures.push(
        `${result.description}: ${result.targetOrphans} orphan(s) on the target, ${result.sourceOrphans} at the source`
      );
    }
  }
};

const printUntouched = (
  results: UntouchedResult[],
  failures: string[]
): void => {
  for (const result of results) {
    const ok = result.before === result.after;

    console.log(
      `${statusText(ok)} untouched ${result.table.padEnd(16)} rows ${pad(
        result.before
      )} -> ${pad(result.after)}`
    );

    if (!ok) {
      failures.push(
        `${result.table}: this script writes no rows here, but the count changed`
      );
    }
  }
};

const options = readOptions(process.argv.slice(2));
const sourceUrl = readUrl("SOURCE_DATABASE_URL");
const targetUrl = readUrl("TARGET_DATABASE_URL");
const sourceEndpoint = describeEndpoint(sourceUrl);
const targetEndpoint = describeEndpoint(targetUrl);
const source = postgres(sourceUrl, { max: MAX_CONNECTIONS });
const target = postgres(targetUrl, { max: MAX_CONNECTIONS });
const failures: string[] = [];

try {
  await Promise.all([prepareSession(source), prepareSession(target)]);

  console.log(`source: ${endpointText(sourceEndpoint)}`);
  console.log(`target: ${endpointText(targetEndpoint)}`);
  console.log(
    `mode:   ${options.dryRun ? "dry run" : "upsert on primary key"}`
  );

  const plans = await Promise.all(
    TABLES.map(async (table) => await introspect(target, table))
  );

  console.log("\n--- copy ---");

  if (options.dryRun) {
    printCounts(await countTables(source, TABLES));
    console.log("\ndry run: nothing was written");
  } else {
    const untouchedBefore = await countTables(target, UNTOUCHED_TABLES);
    const copies = await copyAll(source, target, plans);
    printCopies(copies);
    const untouchedAfter = await countTables(target, UNTOUCHED_TABLES);

    console.log("\n--- reconcile ---");
    const tables = await reconcileAll(source, target, plans, failures);
    printReconcile(tables);

    console.log("\n--- referential integrity ---");
    const references = await collectReferences(source, target);
    printReferences(references, failures);

    const untouched = untouchedResults(untouchedBefore, untouchedAfter);
    printUntouched(untouched, failures);

    console.log("\n--- clear aliases (id-first address model) ---");
    const clearedSlugs = await clearSlugs(target);
    printClearedSlugs(clearedSlugs);

    await writeReport(options.reportPath, {
      clearedSlugs,
      copies,
      dryRun: false,
      failures,
      generatedAt: new Date().toISOString(),
      source: sourceEndpoint,
      tables,
      target: targetEndpoint,
      untouched,
    });
  }
} finally {
  await source.end();
  await target.end();
}

if (failures.length > 0) {
  console.error("\nFAILED:");

  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }

  process.exitCode = 1;
} else if (!options.dryRun) {
  console.log("\nRESULT: every table reconciled");
}
