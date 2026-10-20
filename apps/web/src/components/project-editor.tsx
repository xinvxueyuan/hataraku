"use client";

import { useMutation } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SubmitEvent } from "react";

import { Input } from "@hataraku/ui/components/input";
import { Label } from "@hataraku/ui/components/label";

import {
  FormActions,
  FormFailure,
  firstFailure,
} from "#src/components/admin-form-parts.tsx";
import { ImageUploader } from "#src/components/image-uploader.tsx";
import { api } from "#src/lib/api.ts";

const MarkdownEditor = dynamic(
  async () => {
    const imported = await import("#src/components/markdown-editor.tsx");

    return imported.MarkdownEditor;
  },
  {
    loading: () => (
      <p className="text-muted-foreground p-4 text-sm">正在加载编辑器…</p>
    ),
    ssr: false,
  }
);

const STATUSES = ["active", "wip", "planned", "archived"] as const;

type ProjectStatus = (typeof STATUSES)[number];

const isProjectStatus = (value: string): value is ProjectStatus =>
  STATUSES.some((candidate) => candidate === value);

const toTags = (value: string): string[] =>
  value
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag !== "");

/** An optional text field: an empty box means "no value", not an empty string. */
const orNull = (value: string): string | null =>
  value.trim() === "" ? null : value.trim();

/** The writable fields of one project; the server owns the rest. */
export interface EditableProject {
  bodyMd: string | null;
  coverKey: string | null;
  description: string | null;
  featured: boolean;
  id: string;
  link: string | null;
  published: boolean;
  repo: string | null;
  slug: string;
  sortOrder: number;
  status: string;
  tags: string[];
  title: string;
}

interface ProjectForm {
  bodyMd: string;
  coverKey: string;
  description: string;
  featured: boolean;
  link: string;
  published: boolean;
  repo: string;
  slug: string;
  sortOrder: string;
  status: ProjectStatus;
  tags: string;
  title: string;
}

const EMPTY_FORM: ProjectForm = {
  bodyMd: "",
  coverKey: "",
  description: "",
  featured: false,
  link: "",
  published: true,
  repo: "",
  slug: "",
  sortOrder: "0",
  status: "active",
  tags: "",
  title: "",
};

const initialForm = (project: EditableProject | null): ProjectForm => {
  if (project === null) {
    return EMPTY_FORM;
  }

  const stored = project.status;

  return {
    bodyMd: project.bodyMd ?? "",
    coverKey: project.coverKey ?? "",
    description: project.description ?? "",
    featured: project.featured,
    link: project.link ?? "",
    published: project.published,
    repo: project.repo ?? "",
    slug: project.slug,
    sortOrder: String(project.sortOrder),
    status: isProjectStatus(stored) ? stored : "active",
    tags: project.tags.join(", "),
    title: project.title,
  };
};

const toPayload = (form: ProjectForm) => ({
  bodyMd: form.bodyMd,
  coverKey: orNull(form.coverKey),
  description: orNull(form.description),
  featured: form.featured,
  link: orNull(form.link),
  published: form.published,
  repo: orNull(form.repo),
  slug: form.slug,
  sortOrder: Number(form.sortOrder),
  status: form.status,
  tags: toTags(form.tags),
  title: form.title,
});

const FIELDS = [
  { id: "project-title", key: "title", label: "名称", placeholder: "" },
  {
    id: "project-slug",
    key: "slug",
    label: "Slug",
    placeholder: "留空按名称生成",
  },
  {
    id: "project-link",
    key: "link",
    label: "站点链接",
    placeholder: "https://…",
  },
  {
    id: "project-repo",
    key: "repo",
    label: "仓库链接",
    placeholder: "https://…",
  },
] as const;

/**
 * The project form: identity, status, links, ordering, the cover image and the Markdown detail.
 * The cover goes through the uploader, which keeps only the object key.
 */
export const ProjectEditor = ({
  project,
}: {
  project: EditableProject | null;
}) => {
  const router = useRouter();
  const [form, setForm] = useState<ProjectForm>(() => initialForm(project));

  const patch = (changes: Partial<ProjectForm>) => {
    setForm((previous) => ({ ...previous, ...changes }));
  };

  const create = useMutation(
    api.content.projects.create.mutationOptions({
      onSuccess: (created) => {
        router.replace(`/settings/admin/projects/${created.id}`);
      },
    })
  );

  const update = useMutation(
    api.content.projects.update.mutationOptions({
      onSuccess: () => {
        router.refresh();
      },
    })
  );

  const remove = useMutation(
    api.content.projects.remove.mutationOptions({
      onSuccess: () => {
        router.push("/settings/admin/projects");
      },
    })
  );

  const save = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (project === null) {
      create.mutate(toPayload(form));

      return;
    }

    update.mutate({ ...toPayload(form), id: project.id });
  };

  return (
    <form className="grid gap-5" onSubmit={save}>
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <div className="grid gap-2" key={field.id}>
            <Label htmlFor={field.id}>{field.label}</Label>
            <Input
              id={field.id}
              onChange={(event) => {
                patch({ [field.key]: event.target.value });
              }}
              placeholder={field.placeholder}
              required={field.key === "title"}
              value={form[field.key]}
            />
          </div>
        ))}

        <div className="grid gap-2">
          <Label htmlFor="project-status">状态</Label>
          <select
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            id="project-status"
            onChange={(event) => {
              if (isProjectStatus(event.target.value)) {
                patch({ status: event.target.value });
              }
            }}
            value={form.status}
          >
            {STATUSES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="project-sort-order">排序权重</Label>
          <Input
            id="project-sort-order"
            min={0}
            onChange={(event) => {
              patch({ sortOrder: event.target.value });
            }}
            type="number"
            value={form.sortOrder}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="project-description">简介</Label>
        <textarea
          className="border-input bg-background min-h-20 rounded-md border px-3 py-2 text-sm"
          id="project-description"
          onChange={(event) => {
            patch({ description: event.target.value });
          }}
          value={form.description}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="project-tags">标签</Label>
        <Input
          id="project-tags"
          onChange={(event) => {
            patch({ tags: event.target.value });
          }}
          placeholder="react, rust"
          value={form.tags}
        />
      </div>

      <div className="flex flex-wrap items-center gap-5">
        <label
          className="flex items-center gap-2 text-sm"
          htmlFor="project-published"
        >
          <input
            checked={form.published}
            className="size-4"
            id="project-published"
            onChange={(event) => {
              patch({ published: event.target.checked });
            }}
            type="checkbox"
          />
          前台可见
        </label>

        <label
          className="flex items-center gap-2 text-sm"
          htmlFor="project-featured"
        >
          <input
            checked={form.featured}
            className="size-4"
            id="project-featured"
            onChange={(event) => {
              patch({ featured: event.target.checked });
            }}
            type="checkbox"
          />
          精选
        </label>
      </div>

      <ImageUploader
        label="封面图"
        onChange={(key) => {
          patch({ coverKey: key });
        }}
        prefix="projects"
        scope={form.slug}
        value={form.coverKey}
      />

      <div className="grid gap-2">
        <Label htmlFor="project-body">详情（Markdown）</Label>
        <div className="overflow-hidden rounded-xl border" id="project-body">
          <MarkdownEditor
            onChange={(value) => {
              patch({ bodyMd: value });
            }}
            value={form.bodyMd}
          />
        </div>
      </div>

      <FormFailure
        message={firstFailure([create.error, update.error, remove.error])}
      />

      <FormActions
        deleteLabel={project === null ? undefined : "删除"}
        isCreating={create.isPending}
        isDeleting={remove.isPending}
        isSaving={update.isPending}
        onDelete={
          project === null
            ? undefined
            : () => {
                remove.mutate({ id: project.id });
              }
        }
        submitLabel={project === null ? "创建" : "保存"}
      />
    </form>
  );
};
