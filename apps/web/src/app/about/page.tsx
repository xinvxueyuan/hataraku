import { ORPCError } from "@orpc/client";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@hataraku/ui/components/badge";
import { Card, CardContent } from "@hataraku/ui/components/card";

import { MediaImage } from "#src/components/media-image.tsx";
import { serverCall } from "#src/server/query.ts";

/**
 * About the site: the single profile row, what the site currently holds, and where to go next.
 *
 * Counts are read from the same procedures the index pages use, so this page never advertises a
 * number the archive or taxonomy page contradicts.
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

const focusRing =
  "rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";

const PLACES = [
  {
    description: "按发布月份排列的全部文章。",
    href: "/archive",
    label: "归档",
  },
  {
    description: "按分类与标签重新组织阅读顺序。",
    href: "/taxonomy",
    label: "分类与标签",
  },
  { description: "生活碎片与视觉练习。", href: "/albums", label: "相册" },
  {
    description: "按时间排列并支持筛选的文章列表。",
    href: "/article",
    label: "文章列表",
  },
  { description: "按关键词检索文章正文。", href: "/search", label: "搜索" },
  { description: "站点实现说明，随仓库演进。", href: "/docs", label: "文档" },
] as const;

const AboutPage = async () => {
  const [profile, taxonomy, albums] = await Promise.all([
    loadProfile(),
    serverCall.taxonomy.overview(),
    serverCall.media.albums.list({ page: 1, pageSize: 1 }),
  ]);

  const stats = [
    { href: "/archive", label: "文章", value: taxonomy.totalPosts },
    { href: "/taxonomy", label: "分类", value: taxonomy.categories.length },
    { href: "/taxonomy", label: "标签", value: taxonomy.tags.length },
    { href: "/albums", label: "相册", value: albums.total },
  ] as const;

  // A relative social value points back into this site; the profile's RSS entry is one and this
  // app does not serve a feed yet, so only profiles on other hosts become links.
  const socials = Object.entries(profile?.social ?? {}).filter((entry) =>
    /^https?:\/\//u.test(entry[1])
  );

  const avatarSource = profile?.avatarUrl ?? profile?.avatarKey ?? null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">关于</h1>
        <p className="text-muted-foreground">这个站点是谁在写，写了些什么。</p>
      </header>

      {profile === null ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-6">
          站点资料还没有写入。等它准备好后，这里会介绍作者与站点的来龙去脉——先去{" "}
          <Link className={`${focusRing} underline`} href="/archive">
            归档
          </Link>{" "}
          读几篇文章。
        </p>
      ) : (
        <Card>
          <CardContent>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <span className="bg-muted relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl">
                {avatarSource === null ? (
                  <span
                    aria-hidden="true"
                    className="text-muted-foreground text-2xl font-semibold"
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
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <h2 className="text-2xl font-semibold tracking-tight">
                    {profile.name}
                  </h2>
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
                <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  {profile.author === null ? null : (
                    <span>作者：{profile.author}</span>
                  )}
                  {profile.email === null ? null : (
                    <a
                      className={`${focusRing} underline-offset-4 hover:underline`}
                      href={`mailto:${profile.email}`}
                    >
                      {profile.email}
                    </a>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <section aria-labelledby="stats-heading" className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold" id="stats-heading">
          站点数据
        </h2>
        <ul
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
          data-slot="site-stats"
        >
          {stats.map((stat) => (
            <li key={stat.label}>
              <Link
                className={`${focusRing} hover:bg-accent flex h-full items-center justify-between gap-3 rounded-lg border p-3 transition-colors`}
                href={stat.href}
              >
                <span className="text-muted-foreground text-sm">
                  {stat.label}
                </span>
                <Badge variant="secondary">{stat.value}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="places-heading" className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold" id="places-heading">
          逛逛
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2" data-slot="site-places">
          {PLACES.map((place) => (
            <li key={place.href}>
              <Link
                className={`${focusRing} hover:bg-accent flex h-full flex-col gap-1 rounded-lg border p-4 transition-colors`}
                href={place.href}
              >
                <span className="font-medium">{place.label}</span>
                <span className="text-muted-foreground text-sm">
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
          <h2 className="text-xl font-semibold" id="contact-heading">
            联系方式
          </h2>
          {socials.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              还没有公开的社交链接。想留言的话，发邮件给{" "}
              {profile.email ?? "作者"}。
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2 text-sm">
              {socials.map(([key, url]) => (
                <li key={key}>
                  <a
                    className={`${focusRing} hover:bg-accent inline-flex items-center rounded-full border px-3 py-1 transition-colors`}
                    href={url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {labelForSocial(key)}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <p className="text-muted-foreground text-xs">
            站点资料更新于 {dateFormatter.format(profile.updatedAt)}
          </p>
        </section>
      )}
    </div>
  );
};

export default AboutPage;
