"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SubmitEvent } from "react";

import { Input } from "@hataraku/ui/components/input";
import { Label } from "@hataraku/ui/components/label";

import { fromDateInput, toDateInput } from "#src/components/admin-dates.ts";
import {
  FormActions,
  FormFailure,
  firstFailure,
} from "#src/components/admin-form-parts.tsx";
import { ImageUploader } from "#src/components/image-uploader.tsx";
import { api } from "#src/lib/api.ts";

const POST_TYPES = [
  "text",
  "code",
  "image",
  "dialogue",
  "music",
  "link",
] as const;

type PostType = (typeof POST_TYPES)[number];

const isPostType = (value: string): value is PostType =>
  POST_TYPES.some((candidate) => candidate === value);

const toTags = (value: string): string[] =>
  value
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag !== "");

/** The writable fields of one micro post; the server owns the rest. */
export interface EditableMicroPost {
  content: string;
  id: string;
  imageKeys: string[];
  published: boolean;
  publishedAt: Date | null;
  slug: string;
  tags: string[];
  type: string;
}

interface MicroForm {
  content: string;
  imageKey: string;
  published: boolean;
  publishedAt: string;
  slug: string;
  tags: string;
  type: PostType;
}

const initialForm = (post: EditableMicroPost | null): MicroForm => {
  const stored = post?.type ?? "";
  const imageKey = post?.imageKeys[0] ?? "";

  return {
    content: post?.content ?? "",
    imageKey,
    published: post?.published ?? true,
    publishedAt: toDateInput(post?.publishedAt ?? null),
    slug: post?.slug ?? "",
    tags: (post?.tags ?? []).join(", "),
    type: isPostType(stored) ? stored : "text",
  };
};

const toPayload = (form: MicroForm) => ({
  content: form.content,
  imageKeys: form.imageKey === "" ? [] : [form.imageKey],
  published: form.published,
  publishedAt: fromDateInput(form.publishedAt),
  slug: form.slug,
  tags: toTags(form.tags),
  type: form.type,
});

/**
 * The micro-post form: a short plain-text note, its type, tags, an optional image and the day it
 * goes live. `new` creates; any other id edits, and the editor can delete from here.
 */
export const MicroPostEditor = ({
  post,
}: {
  post: EditableMicroPost | null;
}) => {
  const router = useRouter();
  const [form, setForm] = useState<MicroForm>(() => initialForm(post));

  const patch = (changes: Partial<MicroForm>) => {
    setForm((previous) => ({ ...previous, ...changes }));
  };

  const create = useMutation(
    api.content.micro.create.mutationOptions({
      onSuccess: (created) => {
        router.replace(`/settings/admin/micro/${created.id}`);
      },
    })
  );

  const update = useMutation(
    api.content.micro.update.mutationOptions({
      onSuccess: () => {
        router.refresh();
      },
    })
  );

  const remove = useMutation(
    api.content.micro.remove.mutationOptions({
      onSuccess: () => {
        router.push("/settings/admin/micro");
      },
    })
  );

  const save = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (post === null) {
      create.mutate(toPayload(form));

      return;
    }

    update.mutate({ ...toPayload(form), id: post.id });
  };

  return (
    <form className="grid gap-5" onSubmit={save}>
      <div className="grid gap-2">
        <Label htmlFor="micro-content">内容</Label>
        <textarea
          className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 min-h-28 rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-3"
          id="micro-content"
          onChange={(event) => {
            patch({ content: event.target.value });
          }}
          required
          value={form.content}
        />
        <p className="text-muted-foreground text-xs">
          纯文本，渲染时按文字处理；slug 留空会按内容生成。
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="micro-type">类型</Label>
          <select
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            id="micro-type"
            onChange={(event) => {
              if (isPostType(event.target.value)) {
                patch({ type: event.target.value });
              }
            }}
            value={form.type}
          >
            {POST_TYPES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="micro-tags">标签</Label>
          <Input
            id="micro-tags"
            onChange={(event) => {
              patch({ tags: event.target.value });
            }}
            placeholder="随笔, 夜跑"
            value={form.tags}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="micro-slug">Slug</Label>
          <Input
            id="micro-slug"
            onChange={(event) => {
              patch({ slug: event.target.value });
            }}
            placeholder="留空自动生成"
            value={form.slug}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="micro-published-at">发布日期</Label>
          <Input
            id="micro-published-at"
            onChange={(event) => {
              patch({ publishedAt: event.target.value });
            }}
            type="date"
            value={form.publishedAt}
          />
        </div>
      </div>

      <label
        className="flex items-center gap-2 text-sm"
        htmlFor="micro-published"
      >
        <input
          checked={form.published}
          className="size-4"
          id="micro-published"
          onChange={(event) => {
            patch({ published: event.target.checked });
          }}
          type="checkbox"
        />
        前台可见
      </label>

      <ImageUploader
        label="配图"
        onChange={(key) => {
          patch({ imageKey: key });
        }}
        prefix="micro"
        scope={form.slug}
        value={form.imageKey}
      />

      <FormFailure
        message={firstFailure([create.error, update.error, remove.error])}
      />

      <FormActions
        deleteLabel={post === null ? undefined : "删除"}
        isCreating={create.isPending}
        isDeleting={remove.isPending}
        isSaving={update.isPending}
        onDelete={
          post === null
            ? undefined
            : () => {
                remove.mutate({ id: post.id });
              }
        }
        submitLabel={post === null ? "创建" : "保存"}
      />
    </form>
  );
};
