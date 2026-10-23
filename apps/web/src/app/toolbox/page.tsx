import type { Metadata } from "next";

import { ToolboxHubCard } from "#src/components/toolbox-hub-card.tsx";
import { serverCall } from "#src/server/query.ts";

/**
 * The toolbox hub: four directories that share a shelf, not a subject.
 *
 * Each card carries its own count so the hub never advertises content a section page contradicts,
 * and a module with nothing in it reads as empty here rather than hiding behind a shared total.
 * The counts come from the same procedures the section pages render, with pageSize 1 because the
 * hub needs the total and no rows.
 */
export const metadata: Metadata = {
  description: "工具、设备、技能与友链，各自成页。",
  title: "工具箱",
};

const ToolboxPage = async () => {
  const [tools, devices, skills, friends] = await Promise.all([
    serverCall.content.tools.list({ page: 1, pageSize: 1 }),
    serverCall.media.devices.list({ page: 1, pageSize: 1 }),
    serverCall.content.skills.list(),
    serverCall.content.friends.list(),
  ]);

  const modules = [
    {
      count: tools.total,
      countUnit: "个工具",
      description: "日常在用的软件、终端与编辑器。",
      href: "/toolbox/tools",
      label: "工具",
    },
    {
      count: devices.total,
      countUnit: "台设备",
      description: "手边的机器，连同它们的规格。",
      href: "/toolbox/devices",
      label: "设备",
    },
    {
      count: skills.length,
      countUnit: "项技能",
      description: "按分类整理的技术栈与熟练度。",
      href: "/toolbox/skills",
      label: "技能",
    },
    {
      count: friends.length,
      countUnit: "位朋友",
      description: "常读的站点与写字的人。",
      href: "/toolbox/friends",
      label: "友链",
    },
  ] as const;

  return (
    <div
      className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12"
      data-slot="toolbox-hub"
    >
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">工具箱</h1>
        <p className="text-muted-foreground">
          四份清单，各讲一件事：工具、设备、技能与友链。
        </p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2" data-slot="toolbox-hub-list">
        {modules.map((module) => (
          <li className="min-w-0" key={module.href}>
            <ToolboxHubCard
              count={module.count}
              countUnit={module.countUnit}
              description={module.description}
              href={module.href}
              label={module.label}
            />
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ToolboxPage;
