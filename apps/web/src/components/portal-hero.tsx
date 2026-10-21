import type { SiteProfile } from "#src/components/site-content.ts";
import type { PortalModule } from "#src/server/portal.ts";

/**
 * The portal's poster and identity block.
 *
 * The poster is an editorial surface, not a card: a token-driven colour field, the writing count
 * and the newest line. The identity next to it is the only h1 on the page and gives writing and
 * docs equal billing in the two calls to action. Business copy lives here, not in the shared tile.
 */
const hasText = (value: string | null | undefined): value is string =>
  value !== null && value !== undefined && value !== "";

const Poster = ({
  docs,
  profile,
  writing,
}: {
  docs: PortalModule | undefined;
  profile: SiteProfile | null;
  writing: PortalModule | undefined;
}) => {
  const hero = profile?.hero;
  const latest = writing?.latest ?? null;

  return (
    <div className="from-primary/15 via-muted/40 to-background relative flex min-h-80 flex-col justify-between overflow-hidden rounded-2xl border bg-gradient-to-br p-8">
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
            ? "写作"
            : `写作 · ${latest.date}`}
        </span>
      </div>

      <div className="relative flex flex-col gap-1 py-10">
        <span className="text-7xl leading-none font-semibold tracking-tight tabular-nums">
          {String(writing?.count ?? 0).padStart(2, "0")}
        </span>
        <span className="text-muted-foreground text-sm">
          篇写作 · {docs?.count ?? 0} 篇文档
        </span>
        {hero?.title === undefined ? null : (
          <p className="mt-3 max-w-sm text-lg leading-snug font-medium">
            {hero.title}
          </p>
        )}
      </div>

      <div className="border-border/70 relative border-t pt-4">
        <p className="text-muted-foreground text-xs">最新写作</p>
        {latest === null ? (
          <p className="mt-1 text-sm">还没有发布文章</p>
        ) : (
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
            <span className="line-clamp-1 font-medium">{latest.title}</span>
            {latest.date === null ? null : (
              <span className="text-muted-foreground text-xs">
                {latest.date}
              </span>
            )}
          </p>
        )}
      </div>
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
      <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        Night Stack · Portal
      </p>
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
  const writing = modules.find((module) => module.key === "writing");
  const docs = modules.find((module) => module.key === "docs");

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,520px)_1fr]">
      <Poster docs={docs} profile={profile} writing={writing} />
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
