import "server-only";
import { contentPath } from "#src/components/content-path.ts";
import { docs } from "#src/server/docs.ts";
import type { PortalModule } from "#src/server/portal-modules.ts";
import { buildPortalModules } from "#src/server/portal-modules.ts";
import { serverCall } from "#src/server/query.ts";

/**
 * The portal reads one row per module in parallel and reduces them to a stable shape. Pages never
 * call these procedures themselves: the module list is the only place that decides what the home
 * page knows about the site.
 */
export type { PortalModule } from "#src/server/portal-modules.ts";

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeZone: "Asia/Shanghai",
});

const displayDate = (
  value: Date | string | null | undefined
): string | null => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : dateFormatter.format(date);
};

const firstLine = (value: string): string => {
  const line = value.split("\n")[0]?.trim() ?? "";

  return line === "" ? "微言" : line.slice(0, 48);
};

export const loadPortalModules = async (): Promise<PortalModule[]> => {
  const [posts, projects, albums, notes, changelog, toolbox] =
    await Promise.all([
      serverCall.posts.list({ page: 1, pageSize: 1 }),
      serverCall.content.projects.list({ page: 1, pageSize: 1 }),
      serverCall.media.albums.list({ page: 1, pageSize: 1 }),
      serverCall.content.micro.list({ page: 1, pageSize: 1 }),
      serverCall.content.changelog.list({ page: 1, pageSize: 1 }),
      serverCall.content.tools.list({ page: 1, pageSize: 1 }),
    ]);

  const [post] = posts.items;
  const [project] = projects.items;
  const [album] = albums.items;
  const [note] = notes.items;
  const [release] = changelog.items;
  const [tool] = toolbox.items;

  const latestDoc = docs
    .toSorted((left, right) =>
      (left.updatedAt ?? "").localeCompare(right.updatedAt ?? "")
    )
    .at(-1);

  return buildPortalModules([
    {
      count: posts.total,
      countUnit: "篇",
      href: "/blog",
      key: "writing",
      label: "写作",
      latest:
        post === undefined
          ? null
          : {
              date: displayDate(post.publishedAt ?? post.updatedAt),
              href: contentPath("/blog", post),
              title: post.title,
            },
    },
    {
      count: docs.length,
      countUnit: "篇",
      href: "/docs",
      key: "docs",
      label: "文档",
      latest:
        latestDoc === undefined
          ? null
          : {
              date: displayDate(latestDoc.updatedAt),
              href: `/docs/${latestDoc.slug}`,
              title: latestDoc.title,
            },
    },
    {
      count: projects.total,
      countUnit: "个",
      href: "/projects",
      key: "projects",
      label: "项目",
      latest:
        project === undefined
          ? null
          : {
              date: displayDate(project.publishedAt ?? project.updatedAt),
              href: "/projects",
              title: project.title,
            },
    },
    {
      count: albums.total,
      countUnit: "本",
      href: "/albums",
      key: "albums",
      label: "相册",
      latest:
        album === undefined
          ? null
          : {
              date: displayDate(album.date ?? album.publishedAt),
              href: contentPath("/albums", album),
              title: album.title,
            },
    },
    {
      count: notes.total,
      countUnit: "条",
      href: "/notes",
      key: "notes",
      label: "微言",
      latest:
        note === undefined
          ? null
          : {
              date: displayDate(note.publishedAt),
              href: "/notes",
              title: firstLine(note.content),
            },
    },
    {
      count: changelog.total,
      countUnit: "条",
      href: "/changelog",
      key: "changelog",
      label: "更新日志",
      latest:
        release === undefined
          ? null
          : {
              date: displayDate(release.releasedAt ?? release.createdAt),
              href: "/changelog",
              title: release.title ?? release.version,
            },
    },
    {
      count: toolbox.total,
      countUnit: "件",
      href: "/toolbox",
      key: "toolbox",
      label: "工具箱",
      latest:
        tool === undefined
          ? null
          : {
              date: displayDate(tool.createdAt),
              href: "/toolbox",
              title: tool.name,
            },
    },
  ]);
};
