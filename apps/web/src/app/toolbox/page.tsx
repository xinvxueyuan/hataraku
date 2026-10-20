import { Smartphone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@hataraku/ui/components/badge";

import { focusRing } from "#src/components/focus-ring.ts";
import { MediaImage } from "#src/components/media-image.tsx";
import { Pager } from "#src/components/pager.tsx";
import { serverCall } from "#src/server/query.ts";

/**
 * The toolbox: tools the site actually uses, the devices it runs on, and the skill list.
 *
 * Three independent reads rather than one aggregate procedure: each section is a directory of its
 * own, and a failure in one would be the API's fault, not a reason to hide the other two. Only the
 * tools list pages; devices and skills are short by nature.
 */

export const metadata: Metadata = {
  description: "日常使用的工具、设备与技能清单。",
  title: "工具箱",
};

const TOOL_PAGE_SIZE = 12;
const DIRECTORY_PAGE_SIZE = 100;

const TOOL_CATEGORY_LABELS = new Map([
  ["design", "设计"],
  ["devtools", "开发工具"],
  ["editor", "编辑器"],
  ["terminal", "终端"],
]);

const DEVICE_CATEGORY_LABELS = new Map([
  ["gear", "装备"],
  ["network", "网络设备"],
  ["phone", "手机"],
]);

const DEVICE_STATUS_LABELS = new Map([
  ["active", "在用"],
  ["archived", "退役"],
]);

const SKILL_CATEGORY_LABELS = new Map([
  ["backend", "后端"],
  ["database", "数据库"],
  ["frontend", "前端"],
]);

const labelOf = (labels: Map<string, string>, value: string): string =>
  labels.get(value) ?? value;

type Tool = Awaited<
  ReturnType<typeof serverCall.content.tools.list>
>["items"][number];

type Device = Awaited<
  ReturnType<typeof serverCall.media.devices.list>
>["items"][number];

type Friend = Awaited<
  ReturnType<typeof serverCall.content.friends.list>
>[number];

interface CategoryGroup<T> {
  category: string;
  items: T[];
}

const groupByCategory = <T extends { category: string }>(
  rows: T[]
): CategoryGroup<T>[] => {
  const groups = new Map<string, T[]>();

  for (const row of rows) {
    const items = groups.get(row.category) ?? [];
    items.push(row);
    groups.set(row.category, items);
  }

  return [...groups.entries()].map(([category, items]) => ({
    category,
    items,
  }));
};

const readPage = (raw: string | undefined): number => {
  const parsed = Number(raw ?? "1");

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
};

const hrefFor = (page: number): string =>
  page <= 1 ? "/toolbox" : `/toolbox?page=${page}`;

const specEntries = (
  specs: Record<string, string> | null
): { label: string; value: string }[] => {
  if (specs === null) {
    return [];
  }

  const entries = Object.entries(specs);

  const [first] = entries;

  if (first !== undefined && entries.length === 1 && first[0] === "raw") {
    return [{ label: "规格", value: first[1] }];
  }

  return entries.map(([label, value]) => ({ label, value }));
};

const ToolCard = ({ tool }: { tool: Tool }) => (
  <article className="flex h-full flex-col gap-2 rounded-xl border p-4">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <h3 className="font-medium">{tool.name}</h3>
      <Badge variant="outline">
        {labelOf(TOOL_CATEGORY_LABELS, tool.category)}
      </Badge>
    </div>
    {tool.description === null ? null : (
      <p className="text-muted-foreground text-sm">{tool.description}</p>
    )}
    <div className="mt-auto flex flex-wrap items-end justify-between gap-2">
      {tool.tags.length === 0 ? null : (
        <ul className="flex flex-wrap gap-1">
          {tool.tags.map((tag) => (
            <li key={tag}>
              <Badge variant="secondary">{tag}</Badge>
            </li>
          ))}
        </ul>
      )}
      {tool.link === null ? null : (
        <a
          className={`${focusRing} text-sm underline underline-offset-4`}
          href={tool.link}
          rel="noopener noreferrer"
          target="_blank"
        >
          打开
        </a>
      )}
    </div>
  </article>
);

const DeviceCard = ({ device }: { device: Device }) => {
  const specs = specEntries(device.specs);
  const category = labelOf(DEVICE_CATEGORY_LABELS, device.category);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border">
      <div className="bg-muted relative aspect-video overflow-hidden border-b">
        <MediaImage
          alt={`${device.name} 的照片`}
          assetKey={device.imageKey}
          className="object-cover"
          fill
        />
        {device.imageKey === null ? (
          <span
            aria-hidden="true"
            className="text-muted-foreground absolute inset-0 flex items-center justify-center"
          >
            <Smartphone className="size-8" />
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="font-medium">{device.name}</h3>
          <span className="flex shrink-0 gap-1">
            <Badge variant="outline">{category}</Badge>
            <Badge variant="secondary">
              {labelOf(DEVICE_STATUS_LABELS, device.status)}
            </Badge>
          </span>
        </div>

        {device.brand === null ? null : (
          <p className="text-muted-foreground text-xs">{device.brand}</p>
        )}
        {device.description === null ? null : (
          <p className="text-muted-foreground text-sm">{device.description}</p>
        )}

        {specs.length === 0 ? null : (
          <dl className="text-muted-foreground grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            {specs.map((spec) => (
              <div className="contents" key={spec.label}>
                <dt>{spec.label}</dt>
                <dd>{spec.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {device.link === null ? null : (
          <a
            className={`${focusRing} mt-auto text-sm underline underline-offset-4`}
            href={device.link}
            rel="noopener noreferrer"
            target="_blank"
          >
            了解更多
          </a>
        )}
      </div>
    </article>
  );
};

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

const FriendCard = ({ friend }: { friend: Friend }) => {
  const avatarSource = friend.avatarUrl ?? friend.avatarKey;

  return (
    <article className="flex h-full flex-col gap-2 rounded-xl border p-4">
      <div className="flex items-center gap-3">
        <span className="bg-muted relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full">
          {avatarSource === null ? (
            <span
              aria-hidden="true"
              className="text-muted-foreground text-sm font-semibold"
            >
              {friend.name.slice(0, 1)}
            </span>
          ) : (
            <MediaImage
              alt={`${friend.name} 的头像`}
              assetKey={friend.avatarKey}
              className="object-cover"
              fill
              src={friend.avatarUrl}
            />
          )}
        </span>
        <h3 className="font-medium">{friend.name}</h3>
      </div>

      {friend.description === null ? null : (
        <p className="text-muted-foreground text-sm">{friend.description}</p>
      )}

      {friend.tags.length === 0 ? null : (
        <ul className="flex flex-wrap gap-1">
          {friend.tags.map((tag) => (
            <li key={tag}>
              <Badge variant="secondary">{tag}</Badge>
            </li>
          ))}
        </ul>
      )}

      <a
        className={`${focusRing} mt-auto text-sm underline underline-offset-4`}
        href={friend.url}
        rel="noopener noreferrer"
        target="_blank"
      >
        访问站点
      </a>
    </article>
  );
};

const ToolboxPage = async ({ searchParams }: PageProps) => {
  const { page: rawPage } = await searchParams;
  const page = readPage(rawPage);

  const [tools, devices, skills, friends] = await Promise.all([
    serverCall.content.tools.list({ page, pageSize: TOOL_PAGE_SIZE }),
    serverCall.media.devices.list({ page: 1, pageSize: DIRECTORY_PAGE_SIZE }),
    serverCall.content.skills.list(),
    serverCall.content.friends.list(),
  ]);

  const skillGroups = groupByCategory(skills);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">工具箱</h1>
        <p className="text-muted-foreground">
          {tools.total} 个工具 · {devices.total} 台设备 · {skills.length} 项技能
          · {friends.length} 位朋友。
        </p>
      </header>

      <section aria-labelledby="tools-heading" className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold" id="tools-heading">
          工具
        </h2>

        {tools.items.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6">
            还没有收录工具。把常用的软件与命令整理进来后，它们会出现在这里——先去{" "}
            <Link className={`${focusRing} underline`} href="/projects">
              项目
            </Link>{" "}
            看看现在在做什么。
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2" data-slot="tool-list">
            {tools.items.map((tool) => (
              <li key={tool.id}>
                <ToolCard tool={tool} />
              </li>
            ))}
          </ul>
        )}

        <Pager
          currentPage={tools.page}
          hrefFor={hrefFor}
          label="工具分页"
          totalPages={tools.totalPages}
        />
      </section>

      <section
        aria-labelledby="devices-heading"
        className="flex flex-col gap-4"
      >
        <h2 className="text-xl font-semibold" id="devices-heading">
          设备
        </h2>

        {devices.items.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6">
            还没有设备记录。整理好手上在用的机器后，会在这里列出它们的规格——先去{" "}
            <Link className={`${focusRing} underline`} href="/about">
              关于
            </Link>{" "}
            了解这个站点。
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2" data-slot="device-list">
            {devices.items.map((device) => (
              <li key={device.id}>
                <DeviceCard device={device} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="skills-heading" className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold" id="skills-heading">
          技能
        </h2>

        {skillGroups.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6">
            技能清单还没有整理。等它准备好后，会按分类列在这里——先去{" "}
            <Link className={`${focusRing} underline`} href="/archive">
              归档
            </Link>{" "}
            读几篇相关的文章。
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2" data-slot="skill-list">
            {skillGroups.map((group) => (
              <section className="rounded-xl border p-4" key={group.category}>
                <h3 className="mb-2 text-sm font-medium">
                  {labelOf(SKILL_CATEGORY_LABELS, group.category)}
                </h3>
                <ul className="text-muted-foreground flex flex-col gap-1 text-sm">
                  {group.items.map((skill) => (
                    <li
                      className="flex items-center justify-between gap-2"
                      key={skill.id}
                    >
                      <span>{skill.name}</span>
                      {skill.levelLabel === null ? null : (
                        <span className="text-xs">{skill.levelLabel}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>

      <section
        aria-labelledby="friends-heading"
        className="flex flex-col gap-4"
      >
        <h2 className="text-xl font-semibold" id="friends-heading">
          友链
        </h2>

        {friends.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6">
            还没有友链。等和更多写作者建立来往后再补上——先去{" "}
            <Link className={`${focusRing} underline`} href="/projects">
              项目
            </Link>{" "}
            或{" "}
            <Link className={`${focusRing} underline`} href="/micro">
              微文
            </Link>{" "}
            看看这个站点最近在做什么。
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2" data-slot="friend-list">
            {friends.map((friend) => (
              <li key={friend.id}>
                <FriendCard friend={friend} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default ToolboxPage;
