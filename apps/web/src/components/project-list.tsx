"use client";

import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import Link from "next/link";

import { Button } from "@hataraku/ui/components/button";
import { Card } from "@hataraku/ui/components/card";

import { api } from "#src/lib/api.ts";

/**
 * Every project, drafts included, most recently edited first. The list is the only place that flips
 * "published" without opening the form; everything else lives on the project's own page.
 */
export const ProjectList = () => {
  const queryClient = useQueryClient();

  const { data: projects } = useSuspenseQuery(
    api.content.projects.adminList.queryOptions()
  );

  const invalidate = {
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: api.content.key() });
    },
  };

  const update = useMutation(
    api.content.projects.update.mutationOptions(invalidate)
  );

  const remove = useMutation(
    api.content.projects.remove.mutationOptions(invalidate)
  );

  if (projects.length === 0) {
    return (
      <Card>
        <p className="text-muted-foreground px-4 py-8 text-center text-sm">
          还没有项目。先建一个，把状态和封面填上。
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <ul className="divide-y" data-slot="admin-project-list">
        {projects.map((project) => (
          <li
            className="flex flex-wrap items-center gap-3 px-4 py-3"
            key={project.id}
          >
            <div className="grid min-w-0 flex-1 gap-0.5">
              <Link
                className="truncate font-medium hover:underline"
                href={`/settings/admin/projects/${project.id}`}
              >
                {project.title}
              </Link>
              <span className="text-muted-foreground truncate text-xs">
                {project.status} · 排序 {project.sortOrder} · /projects/
                {project.slug}
              </span>
            </div>

            {project.featured ? (
              <span className="bg-accent text-accent-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                精选
              </span>
            ) : null}

            <span
              className={
                project.published
                  ? "bg-success/15 text-success rounded-full px-2 py-0.5 text-xs font-medium"
                  : "bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium"
              }
            >
              {project.published ? "已发布" : "草稿"}
            </span>

            <Button
              onClick={() => {
                update.mutate({
                  id: project.id,
                  published: !project.published,
                });
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              {project.published ? "撤下" : "发布"}
            </Button>

            <Button
              onClick={() => {
                remove.mutate({ id: project.id });
              }}
              size="sm"
              type="button"
              variant="ghost"
            >
              删除
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
};
