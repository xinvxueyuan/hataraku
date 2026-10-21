import { ORPCError } from "@orpc/server";

const FORBIDDEN: readonly { pattern: RegExp; reason: string }[] = [
  {
    pattern: /(?:^|\n)\s*import\s/u,
    reason: "import statements are not allowed",
  },
  {
    pattern: /(?:^|\n)\s*export\s/u,
    reason: "export statements are not allowed",
  },
  { pattern: /\beval\s*\(/u, reason: "eval is not allowed" },
  {
    pattern: /\bnew\s+Function\s*\(/u,
    reason: "the Function constructor is not allowed",
  },
  { pattern: /\brequire\s*\(/u, reason: "require is not allowed" },
  { pattern: /\bprocess\s*\./u, reason: "process access is not allowed" },
  { pattern: /\bglobalThis\b/u, reason: "globalThis access is not allowed" },
  { pattern: /<script/iu, reason: "script tags are not allowed" },
];

const CODE = String.fromCodePoint(96);

const OPEN_FENCE =
  /^(?<indent> {0,3})(?<marker>[\u0060]{3,}|~{3,})(?<rest>.*)$/u;

const stripFencedCode = (source: string): string => {
  const lines = source.split("\n");
  const output: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const opening = OPEN_FENCE.exec(lines[index] ?? "");

    if (opening === null) {
      output.push(lines[index] ?? "");
      index += 1;
      continue;
    }

    const marker = opening.groups?.marker ?? "";
    const markerChar = marker[0] ?? "";
    const markerLength = marker.length;
    output.push("");
    index += 1;

    while (index < lines.length) {
      const line = lines[index] ?? "";
      const trimmed = line.trimEnd().trimStart();

      const closes =
        trimmed.length >= markerLength &&
        trimmed === markerChar.repeat(trimmed.length);

      output.push("");
      index += 1;

      if (closes) {
        break;
      }
    }
  }

  return output.join("\n");
};

const stripIndentedCode = (source: string): string =>
  source
    .split("\n")
    .map((line) => (/^(?: {4}|\t)/u.test(line) ? "" : line))
    .join("\n");

const stripInlineCode = (source: string): string => {
  let result = "";
  let index = 0;

  while (index < source.length) {
    if (source[index] !== CODE) {
      result += source[index];
      index += 1;
      continue;
    }

    let openingLength = 1;

    while (source[index + openingLength] === CODE) {
      openingLength += 1;
    }

    let cursor = index + openingLength;
    let closing = -1;

    while (cursor < source.length) {
      if (source[cursor] !== CODE) {
        cursor += 1;
        continue;
      }

      let closingLength = 1;

      while (source[cursor + closingLength] === CODE) {
        closingLength += 1;
      }

      if (closingLength === openingLength) {
        closing = cursor;
        break;
      }

      cursor += closingLength;
    }

    if (closing === -1) {
      result += source.slice(index, index + openingLength);
      index += openingLength;
      continue;
    }

    const span = source.slice(index + openingLength, closing);
    result += span.replaceAll(/[^\n]/gu, " ");
    index = closing + openingLength;
  }

  return result;
};

const stripCode = (source: string): string =>
  stripInlineCode(stripIndentedCode(stripFencedCode(source)));

export class UnsafeMdxError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(`Refusing to render MDX: ${reason}`);
    this.name = "UnsafeMdxError";
    this.reason = reason;
  }
}

export const assertSafeMdx = (source: string): void => {
  const code = stripCode(source);

  for (const { pattern, reason } of FORBIDDEN) {
    if (pattern.test(code)) {
      throw new UnsafeMdxError(reason);
    }
  }
};

export const assertStorableBody = (bodyMd: string): void => {
  try {
    assertSafeMdx(bodyMd);
  } catch (error) {
    if (error instanceof UnsafeMdxError) {
      throw new ORPCError("BAD_REQUEST", {
        data: { reason: error.reason },
        message: `This body cannot be saved: ${error.reason}.`,
      });
    }

    throw error;
  }
};
