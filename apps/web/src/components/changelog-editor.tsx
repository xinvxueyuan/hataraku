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

const toLines = (value: string): string[] =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

/** The writable fields of one changelog entry. */
export interface EditableChangelogEntry {
  bodyMd: string | null;
  changes: string[];
  highlight: boolean;
  id: string;
  releasedAt: string | null;
  slug: string;
  title: string | null;
  version: string;
}

interface ChangelogForm {
  bodyMd: string;
  changes: string;
  highlight: boolean;
  releasedAt: string;
  slug: string;
  title: string;
  version: string;
}

const initialForm = (entry: EditableChangelogEntry | null): ChangelogForm => ({
  bodyMd: entry?.bodyMd ?? "",
  changes: (entry?.changes ?? []).join("\n"),
  highlight: entry?.highlight ?? false,
  releasedAt: entry?.releasedAt ?? "",
  slug: entry?.slug ?? "",
  title: entry?.title ?? "",
  version: entry?.version ?? "",
});

const toPayload = (form: ChangelogForm) => ({
  bodyMd: form.bodyMd,
  changes: toLines(form.changes),
  highlight: form.highlight,
  releasedAt: form.releasedAt === "" ? null : form.releasedAt,
  slug: form.slug,
  title: form.title.trim() === "" ? null : form.title.trim(),
  version: form.version,
});

/**
 * The release form: version, slug, date, the bullet list of changes and an optional Markdown body.
 *
 * `changes` is one bullet per line, because the column is a text array and a textarea keeps the form
 * to a shape the author already knows.
 */
export const ChangelogEditor = ({
  entry,
}: {
  entry: EditableChangelogEntry | null;
}) => {
  const router = useRouter();
  const [form, setForm] = useState<ChangelogForm>(() => initialForm(entry));

  const patch = (changes: Partial<ChangelogForm>) => {
    setForm((previous) => ({ ...previous, ...changes }));
  };

  const create = useMutation(
    api.content.changelog.create.mutationOptions({
      onSuccess: (created) => {
        router.replace(`/settings/admin/changelog/${created.id}`);
      },
    })
  );

  const update = useMutation(
    api.content.changelog.update.mutationOptions({
      onSuccess: () => {
        router.refresh();
      },
    })
  );

  const remove = useMutation(
    api.content.changelog.remove.mutationOptions({
      onSuccess: () => {
        router.push("/settings/admin/changelog");
      },
    })
  );

  const save = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (entry === null) {
      create.mutate(toPayload(form));

      return;
    }

    update.mutate({ ...toPayload(form), id: entry.id });
  };

  return (
    <form className="grid gap-5" onSubmit={save}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="changelog-version">版本</Label>
          <Input
            id="changelog-version"
            onChange={(event) => {
              patch({ version: event.target.value });
            }}
            placeholder="v1.2.0"
            required
            value={form.version}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="changelog-slug">Slug</Label>
          <Input
            id="changelog-slug"
            onChange={(event) => {
              patch({ slug: event.target.value });
            }}
            placeholder="留空按版本生成"
            value={form.slug}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="changelog-title">标题</Label>
          <Input
            id="changelog-title"
            onChange={(event) => {
              patch({ title: event.target.value });
            }}
            placeholder="可选"
            value={form.title}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="changelog-released-at">发布日期</Label>
          <Input
            id="changelog-released-at"
            onChange={(event) => {
              patch({ releasedAt: event.target.value });
            }}
            type="date"
            value={form.releasedAt}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="changelog-changes">变更条目（一行一条）</Label>
        <textarea
          className="border-input bg-background min-h-28 rounded-md border px-3 py-2 font-mono text-sm"
          id="changelog-changes"
          onChange={(event) => {
            patch({ changes: event.target.value });
          }}
          placeholder={"修复了导航在窄屏下的换行\n新增对象存储直传"}
          value={form.changes}
        />
      </div>

      <label
        className="flex items-center gap-2 text-sm"
        htmlFor="changelog-highlight"
      >
        <input
          checked={form.highlight}
          className="size-4"
          id="changelog-highlight"
          onChange={(event) => {
            patch({ highlight: event.target.checked });
          }}
          type="checkbox"
        />
        标为重点版本
      </label>

      <div className="grid gap-2">
        <Label htmlFor="changelog-body">正文（Markdown，可选）</Label>
        <div className="overflow-hidden rounded-xl border" id="changelog-body">
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
        deleteLabel={entry === null ? undefined : "删除"}
        isCreating={create.isPending}
        isDeleting={remove.isPending}
        isSaving={update.isPending}
        onDelete={
          entry === null
            ? undefined
            : () => {
                remove.mutate({ id: entry.id });
              }
        }
        submitLabel={entry === null ? "创建" : "保存"}
      />
    </form>
  );
};
