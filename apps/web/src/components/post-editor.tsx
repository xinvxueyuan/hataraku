"use client";

import { useMutation } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ReactNode, SubmitEvent } from "react";

import { Button } from "@hataraku/ui/components/button";
import { Input } from "@hataraku/ui/components/input";
import { Label } from "@hataraku/ui/components/label";

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
  description: string | null;
  id: string;
  slug: string;
  status: "draft" | "published";
  title: string;
}

/** A failed mutation still carries the API's message, which is what the author needs to read. */
const messageOf = (error: Error | null): string | null => {
  if (error === null) {
    return null;
  }

  return error.message;
};

const fieldClassName =
  "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 min-h-20 rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-3";

/**
 * The writing form: title, slug, description and body, saved through the API.
 *
 * A new post is created on first save and the URL is replaced with its id, so the same form keeps
 * working for every later edit. Nothing here touches the database directly: every action is a
 * procedure, and the API re-checks both the allowlist and the MDX guard.
 */
export const PostEditor = ({ post }: { post: EditablePost | null }) => {
  const router = useRouter();
  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [description, setDescription] = useState(post?.description ?? "");
  const [bodyMd, setBodyMd] = useState(post?.bodyMd ?? "");

  const fields = { bodyMd, description, slug, title };

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
      create.mutate(fields);

      return;
    }

    update.mutate({ ...fields, id: post.id });
  };

  const status = post?.status ?? "draft";
  const isPublished = status === "published";
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
      <div className="grid gap-2">
        <Label htmlFor="post-title">标题</Label>
        <Input
          id="post-title"
          onChange={(event) => {
            setTitle(event.target.value);
          }}
          required
          value={title}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="post-slug">Slug</Label>
        <Input
          id="post-slug"
          onChange={(event) => {
            setSlug(event.target.value);
          }}
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          placeholder="lowercase-words-with-dashes"
          required
          value={slug}
        />
        <p className="text-muted-foreground text-xs">
          文章地址是 /posts/&lt;slug&gt;：小写字母、数字与连字符。
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="post-description">摘要</Label>
        <textarea
          className={fieldClassName}
          id="post-description"
          onChange={(event) => {
            setDescription(event.target.value);
          }}
          value={description}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="post-body">正文（Markdown / MDX）</Label>
        <div className="overflow-hidden rounded-xl border" id="post-body">
          <MarkdownEditor onChange={setBodyMd} value={bodyMd} />
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

        <output className="text-muted-foreground text-sm">
          当前状态：{isPublished ? "已发布" : "草稿"}
        </output>

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
