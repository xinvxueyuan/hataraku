import { ORPCError } from "@orpc/client";
import type { Metadata } from "next";
import Link from "next/link";

import { focusRing } from "@hataraku/components/focus-ring";
import { Badge } from "@hataraku/ui/components/badge";

import { formatDisplayDate } from "#src/components/display-date.ts";
import { MediaImage } from "#src/components/media-image.tsx";
import { loadAllRows } from "#src/components/site.ts";
import { serverCall } from "#src/server/query.ts";

/**
 * About the site: who writes it, what it holds, and where to go next.
 *
 * The page is one subject, so it stays one route; the hierarchy carries the weight the split would
 * have carried elsewhere. The first screen is identity and one sentence, the counts are a single
 * line of numbers rather than four tiles, and a section with nothing in it (the timeline, today)
 * renders nothing at all instead of leaving an empty heading standing.
 */

export const metadata: Metadata = {
  description: "站点介绍、内容概览与联系方式。",
  title: "关于",
};

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "long",
  timeZone: "Asia/Shanghai",
});

const SOCIAL_LABELS = new Map([
  ["bilibili", "哔哩哔哩"],
  ["email", "邮箱"],
  ["github", "GitHub"],
  ["rss", "RSS 订阅"],
  ["twitter", "Twitter / X"],
  ["weibo", "微博"],
  ["zhihu", "知乎"],
]);

const labelForSocial = (key: string): string => SOCIAL_LABELS.get(key) ?? key;

const loadProfile = async () => {
  try {
    return await serverCall.site.profile();
  } catch (error) {
    if (error instanceof ORPCError && error.code === "NOT_FOUND") {
      return null;
    }

    throw error;
  }
};

/** A section that is secondary to the identity: small caps, no card, no border. */
const SECTION_HEADING =
  "text-muted-foreground text-sm font-semibold tracking-wide uppercase";

const PLACES = [
  {
    description: "按发布月份排列的全部文章。",
    href: "/blog/archive",
    label: "归档",
  },
  {
    description: "按分类与标签重新组织阅读顺序。",
    href: "/blog/taxonomy",
    label: "分类与标签",
  },
  { description: "生活碎片与视觉练习。", href: "/albums", label: "相册" },
  {
    description: "按时间排列并支持筛选的写作。",
    href: "/blog",
    label: "写作",
  },
  { description: "按关键词检索文章正文。", href: "/search", label: "搜索" },
  { description: "站点实现说明，随仓库演进。", href: "/docs", label: "文档" },
] as const;

const AboutPage = async () => {
  const [profile, taxonomy, albums, timeline] = await Promise.all([
    loadProfile(),
    serverCall.taxonomy.overview(),
    serverCall.media.albums.list({ page: 1, pageSize: 1 }),
    loadAllRows(
      async (page) =>
        await serverCall.media.timeline.list({ page, pageSize: 100 })
    ),
  ]);

  const stats = [
    { href: "/blog/archive", label: "文章", value: taxonomy.totalPosts },
    {
      href: "/blog/taxonomy",
      label: "分类",
      value: taxonomy.categories.length,
    },
    { href: "/blog/taxonomy", label: "标签", value: taxonomy.tags.length },
    { href: "/albums", label: "相册", value: albums.total },
  ] as const;

  // A relative social value points back into this site; the profile's RSS entry is one and this
  // app does not serve a feed yet, so only profiles on other hosts become links.
  const socials = Object.entries(profile?.social ?? {}).filter((entry) =>
    /^https?:\/\//u.test(entry[1])
  );

  const avatarSource = profile?.avatarUrl ?? profile?.avatarKey ?? null;

  const hasContact =
    profile !== null && (socials.length > 0 || profile.email !== null);

  return (
    <div
      className="mx-auto flex w-full max-w-3xl flex-col px-6"
      data-slot="about"
    >
      <header className="flex min-h-svh flex-col justify-center gap-6 py-16">
        {profile === null ? (
          <h1 className="text-3xl font-semibold tracking-tight">关于</h1>
        ) : (
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <span className="bg-muted relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-3xl sm:size-24">
              {avatarSource === null ? (
                <span
                  aria-hidden="true"
                  className="text-muted-foreground text-3xl font-semibold"
                >
                  {profile.name.slice(0, 1)}
                </span>
              ) : (
                <MediaImage
                  alt={`${profile.name} 的头像`}
                  assetKey={profile.avatarKey}
                  fill
                  src={profile.avatarUrl}
                />
              )}
            </span>
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                  {profile.name}
                </h1>
                {profile.nameEn === null ? null : (
                  <span className="text-muted-foreground text-sm">
                    {profile.nameEn}
                  </span>
                )}
              </div>
              {profile.tagline === null ? null : (
                <p className="text-sm">{profile.tagline}</p>
              )}
              {profile.description === null ? null : (
                <p className="text-muted-foreground">{profile.description}</p>
              )}
              {profile.author === null ? null : (
                <p className="text-muted-foreground text-xs">
                  作者 {profile.author}
                </p>
              )}
            </div>
          </div>
        )}

        {profile === null ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6">
            站点资料还没有写入。等它准备好后，这里会介绍作者与站点的来龙去脉——先去{" "}
            <Link className={`${focusRing} underline`} href="/blog/archive">
              归档
            </Link>{" "}
            读几篇文章。
          </p>
        ) : null}
        <ul
          className="flex flex-wrap items-baseline gap-x-6 gap-y-2"
          data-slot="site-stats"
        >
          {stats.map((stat) => (
            <li key={stat.label}>
              <Link
                className={`${focusRing} inline-flex items-baseline gap-1.5 hover:underline`}
                href={stat.href}
              >
                <span className="text-lg font-semibold tabular-nums">
                  {stat.value}
                </span>
                <span className="text-muted-foreground text-sm">
                  {stat.label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </header>

      <div className="flex flex-col gap-12 pb-20">
        {timeline.length === 0 ? null : (
          <section
            aria-labelledby="timeline-heading"
            className="flex flex-col gap-3"
          >
            <h2 className={SECTION_HEADING} id="timeline-heading">
              时间线
            </h2>
            <ol
              className="flex flex-col gap-5 border-l pl-6"
              data-slot="site-timeline"
            >
              {timeline.map((entry) => (
                <li className="relative flex flex-col gap-1" key={entry.id}>
                  <span
                    aria-hidden="true"
                    className="bg-primary absolute top-1.5 -left-[31px] size-2.5 rounded-full"
                  />
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <time
                      className="text-muted-foreground font-mono text-xs"
                      dateTime={entry.date ?? undefined}
                    >
                      {entry.date === null
                        ? dateFormatter.format(entry.createdAt)
                        : (formatDisplayDate(entry.date) ?? entry.date)}
                    </time>
                    <span className="font-medium">{entry.title}</span>
                    {entry.highlight ? <Badge>里程碑</Badge> : null}
                    <Badge variant="outline">{entry.category}</Badge>
                  </div>
                  {entry.description === null ? null : (
                    <p className="text-muted-foreground text-sm">
                      {entry.description}
                    </p>
                  )}
                  {entry.link === null ? null : (
                    <a
                      className={`${focusRing} w-fit text-sm underline underline-offset-4`}
                      href={entry.link}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {entry.link}
                    </a>
                  )}
                </li>
              ))}
            </ol>
          </section>
        )}

        <section
          aria-labelledby="places-heading"
          className="flex flex-col gap-3"
        >
          <h2 className={SECTION_HEADING} id="places-heading">
            逛逛
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2" data-slot="site-places">
            {PLACES.map((place) => (
              <li key={place.href}>
                <Link
                  className={`${focusRing} flex flex-col gap-0.5 rounded-sm py-0.5`}
                  href={place.href}
                >
                  <span className="text-sm font-medium underline-offset-4 hover:underline">
                    {place.label}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {place.description}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {profile === null ? null : (
          <section
            aria-labelledby="contact-heading"
            className="flex flex-col gap-3"
          >
            <h2 className={SECTION_HEADING} id="contact-heading">
              联系方式
            </h2>
            {hasContact ? null : (
              <p className="text-muted-foreground text-sm">
                还没有公开的联系方式。
              </p>
            )}
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {profile.email === null ? null : (
                <li>
                  <a
                    className={`${focusRing} underline-offset-4 hover:underline`}
                    href={`mailto:${profile.email}`}
                  >
                    {profile.email}
                  </a>
                </li>
              )}
              {socials.map(([key, url]) => (
                <li key={key}>
                  <a
                    className={`${focusRing} underline-offset-4 hover:underline`}
                    href={url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {labelForSocial(key)}
                  </a>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground text-xs">
              站点资料更新于 {dateFormatter.format(profile.updatedAt)}
            </p>
          </section>
        )}
      </div>
    </div>
  );
};

export default AboutPage;
