"use client";

import { useMutation } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ReactNode, SubmitEvent } from "react";

import { Button } from "@hataraku/ui/components/button";
import { Input } from "@hataraku/ui/components/input";
import { Label } from "@hataraku/ui/components/label";

import { fromDateInput, toDateInput } from "#src/components/admin-dates.ts";
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

/** A post as the editor needs it: the writable fields, drafts included. */
export interface EditablePost {
  bodyMd: string;
  categorySlug: string | null;
  coverKey: string | null;
  description: string | null;
  featured: boolean;
  id: string;
  publishedAt: Date | null;
  slug: string;
  status: "draft" | "published";
  tagSlugs: string[];
  title: string;
}

/** A category the post can be filed under, as the form lists it. */
export interface CategoryOption {
  name: string;
  slug: string;
}

interface PostForm {
  bodyMd: string;
  categorySlug: string;
  coverKey: string;
  description: string;
  featured: boolean;
  publishedAt: string;
  slug: string;
  tags: string;
  title: string;
}

const initialForm = (post: EditablePost | null): PostForm => ({
  bodyMd: post?.bodyMd ?? "",
  categorySlug: post?.categorySlug ?? "",
  coverKey: post?.coverKey ?? "",
  description: post?.description ?? "",
  featured: post?.featured ?? false,
  publishedAt: toDateInput(post?.publishedAt ?? null),
  slug: post?.slug ?? "",
  tags: (post?.tagSlugs ?? []).join(", "),
  title: post?.title ?? "",
});

/** An empty box means "no value", not an empty string, for every optional field. */
const orNull = (value: string): string | null =>
  value.trim() === "" ? null : value.trim();

const splitTags = (value: string): string[] =>
  value.split(",").flatMap((tag) => {
    const trimmed = tag.trim();

    return trimmed === "" ? [] : [trimmed];
  });

const toPayload = (form: PostForm) => ({
  bodyMd: form.bodyMd,
  categorySlug: orNull(form.categorySlug),
  coverKey: orNull(form.coverKey),
  description: orNull(form.description),
  featured: form.featured,
  publishedAt: fromDateInput(form.publishedAt),
  slug: form.slug,
  tagSlugs: splitTags(form.tags),
  title: form.title,
});

/** A failed mutation still carries the API's message, which is what the author needs to read. */
const messageOf = (error: Error | null): string | null =>
  error === null ? null : error.message;

const fieldClassName =
  "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 min-h-20 rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-3";

/**
 * The writing form: title, slug, summary, filing (category and tags), cover, publish day and body.
 *
 * A new post is created on first save and the URL is replaced with its id, so the same form keeps
 * working for every later edit. Nothing here touches the database directly: every action is a
 * procedure, and the API re-checks the allowlist, the MDX guard and the taxonomy it resolves.
 */
export const PostEditor = ({
  categories,
  post,
}: {
  categories: CategoryOption[];
  post: EditablePost | null;
}) => {
  const router = useRouter();
  const [form, setForm] = useState<PostForm>(() => initialForm(post));

  const patch = (changes: Partial<PostForm>) => {
    setForm((previous) => ({ ...previous, ...changes }));
  };

  const create = useMutation(
    api.posts.create.mutationOptions({
      onSuccess: (created) => {
        router.replace(`/settings/admin/posts/${created.id}`);
      },
    })
  );

  const update = useMutation(
    api.posts.update.mutationOptions({
      onSuccess: () => {
        router.refresh();
      },
    })
  );

  const publish = useMutation(
    api.posts.publish.mutationOptions({
      onSuccess: () => {
        router.refresh();
      },
    })
  );

  const unpublish = useMutation(
    api.posts.unpublish.mutationOptions({
      onSuccess: () => {
        router.refresh();
      },
    })
  );

  const remove = useMutation(
    api.posts.remove.mutationOptions({
      onSuccess: () => {
        router.push("/settings/admin/posts");
      },
    })
  );

  /** Save keeps the stored status; a new post starts as a draft. */
  const save = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (post === null) {
      create.mutate(toPayload(form));

      return;
    }

    update.mutate({ ...toPayload(form), id: post.id });
  };

  const isPublished = (post?.status ?? "draft") === "published";
  const busy = create.isPending || update.isPending;

  const failure = [
    create.error,
    update.error,
    publish.error,
    unpublish.error,
    remove.error,
  ]
    .map((error) => messageOf(error))
    .find((message) => message !== null);

  let statusAction: ReactNode = null;

  if (post !== null && isPublished) {
    statusAction = (
      <Button
        disabled={unpublish.isPending}
        onClick={() => {
          unpublish.mutate({ id: post.id });
        }}
        type="button"
        variant="outline"
      >
        取消发布
      </Button>
    );
  } else if (post !== null) {
    statusAction = (
      <Button
        disabled={publish.isPending}
        onClick={() => {
          publish.mutate({ id: post.id });
        }}
        type="button"
        variant="secondary"
      >
        发布
      </Button>
    );
  }

  return (
    <form className="grid gap-6" onSubmit={save}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="post-title">标题</Label>
          <Input
            id="post-title"
            onChange={(event) => {
              patch({ title: event.target.value });
            }}
            required
            value={form.title}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="post-slug">Slug</Label>
          <Input
            id="post-slug"
            onChange={(event) => {
              patch({ slug: event.target.value });
            }}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            placeholder="lowercase-words-with-dashes"
            required
            value={form.slug}
          />
          <p className="text-muted-foreground text-xs">
            文章地址是 /posts/&lt;slug&gt;：小写字母、数字与连字符。
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="post-category">分类</Label>
          <Input
            id="post-category"
            list="post-category-options"
            onChange={(event) => {
              patch({ categorySlug: event.target.value });
            }}
            placeholder="选一个，或输入新的分类 slug"
            value={form.categorySlug}
          />
          <datalist id="post-category-options">
            {categories.map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.name}
              </option>
            ))}
          </datalist>
          <p className="text-muted-foreground text-xs">
            留空表示不分分类；输入不存在的 slug 会新建该分类（名称与 slug
            相同）。
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="post-tags">标签</Label>
          <Input
            id="post-tags"
            onChange={(event) => {
              patch({ tags: event.target.value });
            }}
            placeholder="react, 随笔"
            value={form.tags}
          />
          <p className="text-muted-foreground text-xs">
            用逗号分隔；不存在的标签会新建。标签页地址是
            /taxonomy/tag/&lt;slug&gt;。
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="post-published-at">发布日期</Label>
          <Input
            id="post-published-at"
            onChange={(event) => {
              patch({ publishedAt: event.target.value });
            }}
            type="date"
            value={form.publishedAt}
          />
          <p className="text-muted-foreground text-xs">
            留空时首次发布会自动记为当天。
          </p>
        </div>

        <label
          className="mt-1 flex items-center gap-2 self-end text-sm"
          htmlFor="post-featured"
        >
          <input
            checked={form.featured}
            className="size-4"
            id="post-featured"
            onChange={(event) => {
              patch({ featured: event.target.checked });
            }}
            type="checkbox"
          />
          精选
        </label>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="post-description">摘要</Label>
        <textarea
          className={fieldClassName}
          id="post-description"
          onChange={(event) => {
            patch({ description: event.target.value });
          }}
          value={form.description}
        />
      </div>

      <ImageUploader
        label="封面图"
        onChange={(key) => {
          patch({ coverKey: key });
        }}
        prefix="posts"
        scope={form.slug}
        value={form.coverKey}
      />

      <div className="grid gap-2">
        <Label htmlFor="post-body">正文（Markdown / MDX）</Label>
        <div className="overflow-hidden rounded-xl border" id="post-body">
          <MarkdownEditor
            onChange={(value) => {
              patch({ bodyMd: value });
            }}
            value={form.bodyMd}
          />
        </div>
      </div>

      {failure === null ? null : (
        <p
          className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm"
          role="alert"
        >
          {failure}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={busy} type="submit">
          {post === null ? "创建草稿" : "保存"}
        </Button>

        {statusAction}

        {post === null ? null : (
          <Button
            className="ml-auto"
            disabled={remove.isPending}
            onClick={() => {
              remove.mutate({ id: post.id });
            }}
            type="button"
            variant="destructive"
          >
            删除
          </Button>
        )}
      </div>
    </form>
  );
};
