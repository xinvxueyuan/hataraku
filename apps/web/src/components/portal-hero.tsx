import type { SiteProfile } from "#src/components/site-content.ts";
import type { PortalModule } from "#src/server/portal.ts";

/**
 * The portal's poster and identity block.
 *
 * The identity is the page's only h1. The poster carries what the identity does not: the four
 * content counts, the newest writing date, and the author's own description of the archive. It is
 * deliberately not stretched to the identity's height: a fixed frame around shifting copy leaves a
 * hole, while a poster that ends where its content ends stays balanced.
 */
const hasText = (value: string | null | undefined): value is string =>
  value !== null && value !== undefined && value !== "";

const moduleCount = (
  modules: readonly PortalModule[],
  key: PortalModule["key"]
): PortalModule | undefined => modules.find((module) => module.key === key);

const countOf = (
  modules: readonly PortalModule[],
  key: PortalModule["key"]
): number => moduleCount(modules, key)?.count ?? 0;

const Stats = ({
  albums,
  description,
  docs,
  projects,
  writing,
}: {
  albums: number;
  description: string | undefined;
  docs: number;
  projects: number;
  writing: number;
}) => (
  <div className="relative flex flex-col gap-3">
    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="text-3xl leading-none font-semibold tracking-tight tabular-nums sm:text-4xl">
        {writing}
      </span>
      <span className="text-sm font-medium">篇文章</span>
      <span className="text-muted-foreground text-sm">· {docs} 篇文档</span>
    </p>
    <dl className="border-border/70 grid grid-cols-2 gap-x-5 gap-y-2 border-t pt-3 text-sm">
      <div className="flex items-baseline justify-between gap-2">
        <dt className="text-muted-foreground">项目</dt>
        <dd className="font-medium">{projects} 个</dd>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <dt className="text-muted-foreground">相册</dt>
        <dd className="font-medium">{albums} 本</dd>
      </div>
    </dl>
    {hasText(description) ? (
      <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">
        {description}
      </p>
    ) : null}
  </div>
);

const Latest = ({ latest }: { latest: PortalModule["latest"] }) => (
  <div className="border-border/70 relative border-t pt-3">
    <p className="text-muted-foreground text-xs">最新写作</p>
    {latest === null ? (
      <p className="mt-1 text-sm">还没有发布文章</p>
    ) : (
      <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
        <span className="line-clamp-1 font-medium">{latest.title}</span>
        {latest.date === null ? null : (
          <span className="text-muted-foreground text-xs">{latest.date}</span>
        )}
      </p>
    )}
  </div>
);

const Poster = ({
  modules,
  profile,
}: {
  modules: readonly PortalModule[];
  profile: SiteProfile | null;
}) => {
  const hero = profile?.hero;
  const writing = moduleCount(modules, "writing");
  const latest = writing?.latest ?? null;

  return (
    <div className="from-primary/15 via-muted/40 to-background relative flex flex-col gap-5 overflow-hidden rounded-2xl border bg-gradient-to-br p-8">
      <div
        aria-hidden="true"
        className="bg-primary/10 absolute -top-20 -right-20 size-64 rounded-full blur-3xl"
      />
      <div
        aria-hidden="true"
        className="bg-muted/70 absolute -bottom-24 -left-16 size-56 rounded-full blur-3xl"
      />

      <div className="relative flex items-center justify-between gap-3">
        <span className="border-border bg-background/60 text-muted-foreground rounded-full border px-3 py-1 text-xs font-medium">
          {hero?.badge ?? "个人站点"}
        </span>
        <span className="text-muted-foreground text-xs">
          {latest?.date === null || latest?.date === undefined
            ? "最新写作"
            : `写作 · ${latest.date}`}
        </span>
      </div>

      <Stats
        albums={countOf(modules, "albums")}
        description={hero?.description}
        docs={countOf(modules, "docs")}
        projects={countOf(modules, "projects")}
        writing={countOf(modules, "writing")}
      />

      <Latest latest={latest} />
    </div>
  );
};

const Cta = ({
  fallbackHref,
  href,
  label,
  title,
}: {
  fallbackHref: string;
  href: string | undefined;
  label: string;
  title: string | undefined;
}) => (
  <a
    className="hover:bg-accent flex min-w-0 flex-1 flex-col gap-1 rounded-xl border p-4 transition-colors"
    href={href ?? fallbackHref}
  >
    <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
      {label}
    </span>
    <span className="line-clamp-1 font-medium">{title ?? "去看看"}</span>
  </a>
);

const Identity = ({
  docsLatest,
  fallbackDocs,
  fallbackWriting,
  profile,
  writingLatest,
}: {
  profile: SiteProfile | null;
  writingLatest: PortalModule["latest"];
  docsLatest: PortalModule["latest"];
  fallbackWriting: string;
  fallbackDocs: string;
}) => {
  const name = profile?.name ?? "夜行栈";
  const nameEn = profile?.nameEn;
  const tagline = profile?.tagline;
  const description = profile?.description;

  return (
    <div className="flex flex-col justify-center gap-5 px-2 py-4 lg:px-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
          {name}
        </h1>
        {hasText(nameEn) ? (
          <p className="text-muted-foreground text-sm">{nameEn}</p>
        ) : null}
      </div>
      {hasText(tagline) ? (
        <p className="text-lg leading-snug">{tagline}</p>
      ) : null}
      {hasText(description) ? (
        <p className="text-muted-foreground max-w-xl leading-relaxed">
          {description}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Cta
          fallbackHref={fallbackWriting}
          href={writingLatest?.href}
          label="最新写作"
          title={writingLatest?.title}
        />
        <Cta
          fallbackHref={fallbackDocs}
          href={docsLatest?.href}
          label="最新文档"
          title={docsLatest?.title}
        />
      </div>
    </div>
  );
};

export const PortalHero = ({
  modules,
  profile,
}: {
  modules: readonly PortalModule[];
  profile: SiteProfile | null;
}) => {
  const writing = moduleCount(modules, "writing");
  const docs = moduleCount(modules, "docs");

  return (
    <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,520px)_1fr]">
      <Poster modules={modules} profile={profile} />
      <Identity
        docsLatest={docs?.latest ?? null}
        fallbackDocs={docs?.href ?? "/docs"}
        fallbackWriting={writing?.href ?? "/blog"}
        profile={profile}
        writingLatest={writing?.latest ?? null}
      />
    </section>
  );
};
