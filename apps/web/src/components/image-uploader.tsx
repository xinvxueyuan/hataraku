"use client";

import { useMutation } from "@tanstack/react-query";
import Image from "next/image";
import { useState } from "react";
import type { ChangeEvent } from "react";

import { Button } from "@hataraku/ui/components/button";
import { Label } from "@hataraku/ui/components/label";

import { assetUrl } from "#src/components/asset-url.ts";
import { api } from "#src/lib/api.ts";

type UploadPrefix = "micro" | "projects";

interface UploadTicket {
  contentType: string;
  key: string;
  uploadUrl: string;
}

type UploadResult = { message: string; ok: false } | { key: string; ok: true };

/**
 * Sends the bytes to storage. Lives outside the component on purpose: the React compiler only
 * analyses components and hooks, and an async `try/catch` in a component body is what it bails on.
 */
const putFile = async (
  file: File,
  ticket: UploadTicket
): Promise<UploadResult> => {
  try {
    const response = await fetch(ticket.uploadUrl, {
      body: file,
      headers: { "Content-Type": ticket.contentType },
      method: "PUT",
    });

    if (!response.ok) {
      return {
        message: `Storage rejected the upload (HTTP ${response.status}).`,
        ok: false,
      };
    }

    return { key: ticket.key, ok: true };
  } catch {
    return { message: "上传请求没有到达存储，检查网络后重试。", ok: false };
  }
};

/**
 * Uploads one image straight to object storage.
 *
 * The flow has three steps and the server owns the first: ask for a presigned PUT (the API checks the
 * session, the allowlist, the MIME type and the size), send the bytes from the browser, then keep only
 * the object key in the form. The storage credentials never reach this component.
 */
export const ImageUploader = ({
  label,
  onChange,
  prefix,
  scope,
  value,
}: {
  label: string;
  onChange: (key: string) => void;
  prefix: UploadPrefix;
  scope?: string;
  value: string;
}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const presign = useMutation(api.media.uploads.presign.mutationOptions());

  const handleFile = async (file: File) => {
    setBusy(true);
    setError(null);

    const ticket = await presign
      .mutateAsync({
        contentType: file.type,
        prefix,
        scope,
        size: file.size,
      })
      .catch(() => null);

    if (ticket === null) {
      setBusy(false);
      setError("签发上传地址失败，稍后再试。");

      return;
    }

    const result = await putFile(file, ticket);

    setBusy(false);

    if (result.ok) {
      onChange(result.key);

      return;
    }

    setError(result.message);
  };

  const preview = assetUrl(value);

  return (
    <div className="grid gap-2">
      <Label htmlFor={`upload-${prefix}`}>{label}</Label>

      <div className="flex flex-wrap items-center gap-2">
        <input
          accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
          className="border-input bg-background file:bg-secondary file:text-secondary-foreground rounded-md border px-3 py-2 text-xs file:mr-3 file:rounded-md file:border-0 file:px-2 file:py-1"
          disabled={busy}
          id={`upload-${prefix}`}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];

            if (file !== undefined) {
              void handleFile(file);
            }

            event.target.value = "";
          }}
          type="file"
        />

        {value === "" ? null : (
          <Button
            onClick={() => {
              onChange("");
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            清除
          </Button>
        )}
      </div>

      <input
        aria-label={`${label} key`}
        className="border-input bg-background w-full rounded-md border px-3 py-2 font-mono text-xs"
        onChange={(event) => {
          onChange(event.target.value);
        }}
        placeholder="对象 key，上传后自动填入"
        value={value}
      />

      {preview === null ? null : (
        <Image
          alt={`${label}预览`}
          className="border-border h-28 w-auto rounded-xl border object-cover"
          height={112}
          src={preview}
          unoptimized
          width={224}
        />
      )}

      {busy ? <p className="text-muted-foreground text-xs">上传中…</p> : null}

      {error === null ? null : (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};
