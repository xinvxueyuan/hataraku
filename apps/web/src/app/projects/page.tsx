import { FolderGit2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { focusRing } from "@hataraku/components/focus-ring";
import { Pager } from "@hataraku/components/pager";
import { Badge } from "@hataraku/ui/components/badge";

import { MediaImage } from "#src/components/media-image.tsx";
import { serverCall } from "#src/server/query.ts";

/**
 * The project shelf: published projects in the order the site assigns them.
 *
 * A card is built from the list row alone — no detail fetch — because the list already carries the
 * cover, status, tags and links a card shows. Status is free text in the database, so the label map
 * falls back to the stored value instead of pretending every row fits a known state.
 */

export const metadata: Metadata = {
  description: "正在维护和已经交付的项目，附源码与访问入口。",
  title: "项目",
};

const PAGE_SIZE = 12;

const STATUS_LABELS = new Map([
  ["active", "进行中"],
  ["archived", "已归档"],
  ["wip", "筹备中"],
]);

const statusLabel = (status: string): string =>
  STATUS_LABELS.get(status) ?? status;

type Project = Awaited<
  ReturnType<typeof serverCall.content.projects.list>
>["items"][number];

const readPage = (raw: string | undefined): number => {
  const parsed = Number(raw ?? "1");

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
};

const hrefFor = (page: number): string =>
  page <= 1 ? "/projects" : `/projects?page=${page}`;

const linksOf = (project: Project): { href: string; label: string }[] => {
  const links = new Map<string, string>();

  if (project.link !== null && project.link.trim() !== "") {
    links.set(project.link, "访问项目");
  }

  if (project.repo !== null && project.repo.trim() !== "") {
    links.set(project.repo, links.has(project.repo) ? "访问项目" : "源码");
  }

  return [...links.entries()].map(([href, label]) => ({ href, label }));
};

const ProjectCard = ({ project }: { project: Project }) => {
  const coverSource = project.cover?.src ?? project.coverKey;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border">
      <div className="bg-muted relative aspect-video overflow-hidden border-b">
        <MediaImage
          alt={`${project.title} 的封面`}
          assetKey={project.coverKey}
          className="object-cover"
          fill
          src={project.cover?.src}
        />
        {coverSource === null || coverSource === undefined ? (
          <span
            aria-hidden="true"
            className="text-muted-foreground absolute inset-0 flex items-center justify-center"
          >
            <FolderGit2 className="size-8" />
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-lg leading-snug font-medium">{project.title}</h2>
          <span className="flex shrink-0 flex-wrap gap-1">
            {project.featured ? <Badge variant="outline">精选</Badge> : null}
            <Badge variant="secondary">{statusLabel(project.status)}</Badge>
          </span>
        </div>

        {project.description === null ? null : (
          <p className="text-muted-foreground text-sm">{project.description}</p>
        )}

        {project.tags.length === 0 ? null : (
          <ul className="flex flex-wrap gap-2">
            {project.tags.map((tag) => (
              <li key={tag}>
                <Badge variant="secondary">{tag}</Badge>
              </li>
            ))}
          </ul>
        )}

        {linksOf(project).length === 0 ? null : (
          <ul className="mt-auto flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {linksOf(project).map((link) => (
              <li key={link.href}>
                <a
                  className={`${focusRing} underline underline-offset-4`}
                  href={link.href}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
};

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

const ProjectsPage = async ({ searchParams }: PageProps) => {
  const { page: rawPage } = await searchParams;
  const page = readPage(rawPage);

  const result = await serverCall.content.projects.list({
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">项目</h1>
        <p className="text-muted-foreground">
          共 {result.total} 个项目，按站点设定顺序排列。
        </p>
      </header>

      {result.items.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-6">
          {result.total === 0 ? (
            <>
              还没有公开的项目。等项目整理好后会出现在这里——先去{" "}
              <Link className={`${focusRing} underline`} href="/article">
                文章列表
              </Link>{" "}
              看看最近在写什么，或者回到{" "}
              <Link className={`${focusRing} underline`} href="/">
                首页
              </Link>
              。
            </>
          ) : (
            <>
              这一页没有项目了。{" "}
              <Link className={`${focusRing} underline`} href="/projects">
                回到第一页
              </Link>
              。
            </>
          )}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2" data-slot="project-list">
          {result.items.map((project) => (
            <li key={project.id}>
              <ProjectCard project={project} />
            </li>
          ))}
        </ul>
      )}

      <Pager
        currentPage={result.page}
        hrefFor={hrefFor}
        label="项目分页"
        totalPages={result.totalPages}
      />
    </div>
  );
};

export default ProjectsPage;
