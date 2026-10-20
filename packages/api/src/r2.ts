import { randomUUID } from "node:crypto";

/**
 * Cloudflare R2 direct upload: the policy the server enforces and the presigned PUT it hands back.
 *
 * The browser uploads the bytes itself (browser → R2). The server only authenticates, validates and
 * signs, so a large image never passes through a function and the R2 secret never leaves the server.
 *
 * Policy, all enforced here rather than in the browser:
 * - only the image types below are accepted, and the object extension comes from the MIME type —
 *   a filename is never trusted for it;
 * - one file is capped at {@link UPLOAD_MAX_BYTES};
 * - the object prefix is a closed list, so a request cannot write anywhere in the bucket;
 * - the key is built from sanitized segments only.
 *
 * Configuration is read lazily from the environment so a build without R2 credentials still passes,
 * and the error names the missing variables instead of surfacing an SDK credential error. The web
 * deployment serves the API in process, so both deployments read the same five variables.
 */
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";

/** MIME type to object extension. The extension comes from here and nowhere else. */
const MIME_EXTENSIONS = {
  "image/avif": "avif",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const satisfies Record<string, string>;

type SupportedMimeType = keyof typeof MIME_EXTENSIONS;

/** The closed set of accepted types, for the form hint and the error message. */
export const ALLOWED_MIME_TYPES = Object.keys(MIME_EXTENSIONS);

/** 10 MiB. A cover image has no business being larger, and the browser uploads it directly. */
export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

/** A presigned URL is short-lived on purpose: the browser starts the PUT immediately after asking. */
const UPLOAD_URL_TTL_SECONDS = 600;

/** Object prefixes, one per content surface. Mirrors the keys the migrated rows already carry. */
export const UPLOAD_PREFIXES = [
  "albums",
  "brand",
  "devices",
  "diary",
  "friends",
  "micro",
  "now",
  "posts",
  "projects",
  "tools",
  "uploads",
] as const;

const uploadPrefixSchema = z.enum(UPLOAD_PREFIXES);

/** What the form asks for before it picks a file. */
export const requestUploadInput = z.object({
  contentType: z.string().trim().min(1).max(120),
  prefix: uploadPrefixSchema,
  scope: z.string().trim().max(48).optional(),
  size: z
    .int()
    .positive()
    .max(
      UPLOAD_MAX_BYTES,
      `A cover image is limited to ${UPLOAD_MAX_BYTES / 1024 / 1024} MiB.`
    ),
});

export type RequestUploadInput = z.infer<typeof requestUploadInput>;

export interface UploadPlan {
  contentType: string;
  key: string;
  prefix: (typeof UPLOAD_PREFIXES)[number];
  size: number;
}

export interface PresignedUpload {
  contentType: string;
  expiresIn: number;
  key: string;
  maxBytes: number;
  publicUrl: string;
  uploadUrl: string;
}

/**
 * Everything the signer and the URL builder need. `R2_PUBLIC_BASE_URL` is required rather than
 * defaulted on purpose: the public host is deployment configuration, so moving the bucket to another
 * domain is an environment change, never a code change.
 */
const REQUIRED_ENV = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_BUCKET",
  "R2_PUBLIC_BASE_URL",
  "R2_SECRET_ACCESS_KEY",
] as const;

interface R2Config {
  accessKeyId: string;
  accountId: string;
  bucket: string;
  publicBaseUrl: string;
  secretAccessKey: string;
}

let cachedConfig: R2Config | null = null;
let cachedClient: S3Client | null = null;

/** True when every credential the signer needs is present. */
export const hasR2Config = (): boolean =>
  REQUIRED_ENV.every((name) => (process.env[name] ?? "").trim() !== "");

const r2Config = (): R2Config => {
  if (cachedConfig !== null) {
    return cachedConfig;
  }

  const missing = REQUIRED_ENV.filter(
    (name) => (process.env[name] ?? "").trim() === ""
  );

  if (missing.length > 0) {
    throw new Error(
      `R2 is not configured: ${missing.join(", ")}. Set them in apps/server/.env (or the deployment's environment).`
    );
  }

  cachedConfig = {
    accessKeyId: (process.env.R2_ACCESS_KEY_ID ?? "").trim(),
    accountId: (process.env.R2_ACCOUNT_ID ?? "").trim(),
    bucket: (process.env.R2_BUCKET ?? "").trim(),
    publicBaseUrl: (process.env.R2_PUBLIC_BASE_URL ?? "")
      .trim()
      .replace(/\/+$/u, ""),
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  };

  return cachedConfig;
};

/**
 * The S3-compatible client.
 *
 * `region: "auto"` is what R2 accepts, and `forcePathStyle` keeps the presigned URL on
 * `/<bucket>/<key>` so it stays valid behind a custom domain. `requestChecksumCalculation` is
 * lowered on purpose: the SDK otherwise adds `x-amz-checksum-crc32` to the signature, and a
 * browser PUT that does not replay that header gets a 400 from R2.
 */
const r2Client = (): S3Client => {
  if (cachedClient !== null) {
    return cachedClient;
  }

  const { accessKeyId, accountId, secretAccessKey } = r2Config();

  cachedClient = new S3Client({
    credentials: { accessKeyId, secretAccessKey },
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    region: "auto",
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });

  return cachedClient;
};

/** The public URL for an object key; an absolute URL or a site path passes through unchanged. */
const r2PublicUrl = (key: string): string => {
  const value = key.trim().replaceAll(/^\/+/gu, "");

  if (/^(?:https?:)?\/\//u.test(value)) {
    return value;
  }

  return `${r2Config().publicBaseUrl}/${value}`;
};

/** A key segment: lowercase letters, digits, dots, dashes. Anything else collapses to a dash. */
const sanitizeSegment = (value: string, fallback: string): string => {
  const cleaned = value
    .toLowerCase()
    .replaceAll(/[^a-z0-9._-]+/gu, "-")
    .replaceAll(/-{2,}/gu, "-")
    .replaceAll(/\.{2,}/gu, ".")
    .replace(/^[-.]+/u, "")
    .replace(/[-.]+$/u, "")
    .slice(0, 48);

  return cleaned === "" ? fallback : cleaned;
};

/** Narrowing by the table itself, so the lookup cannot assert a member the caller picked. */
const isSupportedMimeType = (value: string): value is SupportedMimeType =>
  Object.hasOwn(MIME_EXTENSIONS, value);

const extensionFor = (contentType: string): string | null => {
  const key = contentType.trim().toLowerCase();

  return isSupportedMimeType(key) ? MIME_EXTENSIONS[key] : null;
};

/** `YYYYMMDDHHMMSS`, so keys sort by upload time within a prefix. */
const stampOf = (now: Date): string =>
  now.toISOString().replaceAll(/[-:T]/gu, "").slice(0, 14);

/**
 * Plans the object key for a validated request, or `null` when the MIME type is not an image this
 * deployment accepts. Pure: the unit test pins the key shape and the rejections.
 */
export const planUpload = (
  input: RequestUploadInput,
  now: Date = new Date()
): UploadPlan | null => {
  const contentType = input.contentType.trim().toLowerCase();
  const extension = extensionFor(contentType);

  if (extension === null) {
    return null;
  }

  const scope = sanitizeSegment(input.scope ?? "", "general");

  return {
    contentType,
    key: `${input.prefix}/${scope}/${stampOf(now)}-${randomUUID().slice(0, 8)}.${extension}`,
    prefix: input.prefix,
    size: input.size,
  };
};

/**
 * Signs a PUT for the planned key. The content type is signed with it, so the browser has to send
 * the same `Content-Type`.
 */
export const createPresignedUpload = async (
  plan: UploadPlan
): Promise<PresignedUpload> => {
  const { bucket } = r2Config();

  const uploadUrl = await getSignedUrl(
    r2Client(),
    new PutObjectCommand({
      Bucket: bucket,
      ContentLength: plan.size,
      ContentType: plan.contentType,
      Key: plan.key,
    }),
    { expiresIn: UPLOAD_URL_TTL_SECONDS }
  );

  return {
    contentType: plan.contentType,
    expiresIn: UPLOAD_URL_TTL_SECONDS,
    key: plan.key,
    maxBytes: UPLOAD_MAX_BYTES,
    publicUrl: r2PublicUrl(plan.key),
    uploadUrl,
  };
};
