import type { Metadata } from "next";
import Link from "next/link";

import { focusRing } from "@hataraku/components/focus-ring";

import { ToolboxSection } from "#src/components/toolbox-section.tsx";
import { serverCall } from "#src/server/query.ts";

/**
 * The skill list, grouped by category.
 *
 * Skills are a flat array in the procedure — long enough to want grouping, short enough that the
 * whole list loads in one read, so the page groups in memory instead of asking for facets.
 */

export const metadata: Metadata = {
  description: "按分类整理的技术栈与熟练度。",
  title: "技能",
};

const CATEGORY_LABELS = new Map([
  ["backend", "后端"],
  ["database", "数据库"],
  ["frontend", "前端"],
]);

type Skill = Awaited<ReturnType<typeof serverCall.content.skills.list>>[number];

interface CategoryGroup {
  category: string;
  items: Skill[];
}

const groupByCategory = (rows: Skill[]): CategoryGroup[] => {
  const groups = new Map<string, Skill[]>();

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

const SkillsPage = async () => {
  const skills = await serverCall.content.skills.list();
  const groups = groupByCategory(skills);

  return (
    <ToolboxSection
      count={`共 ${skills.length} 项技能`}
      description="按分类整理的技术栈与熟练度。"
      empty={
        <p className="text-muted-foreground rounded-lg border border-dashed p-6">
          技能清单还没有整理。等它准备好后，会按分类列在这里——先去{" "}
          <Link className={`${focusRing} underline`} href="/blog/archive">
            归档
          </Link>{" "}
          读几篇相关的文章。
        </p>
      }
      hasItems={groups.length > 0}
      title="技能"
    >
      <div className="grid gap-4 sm:grid-cols-2" data-slot="skill-list">
        {groups.map((group) => (
          <section className="rounded-xl border p-4" key={group.category}>
            <h2 className="mb-2 text-sm font-medium">
              {CATEGORY_LABELS.get(group.category) ?? group.category}
            </h2>
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
    </ToolboxSection>
  );
};

export default SkillsPage;
