import { ORPCError } from "@orpc/server";

/**
 * Policy for MDX coming from the editor.
 *
 * The rule lives here, in the package that owns the write path, so a body is checked before it is
 * stored and the renderer applies the same rule to what it reads back. Keeping one definition is
 * the point: two copies drift, and the weaker copy becomes the real boundary.
 */

/** Syntax that has no place in an article body. */
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

/** Thrown when a body carries syntax the renderer refuses to compile. */
export class UnsafeMdxError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(`Refusing to render MDX: ${reason}`);
    this.name = "UnsafeMdxError";
    this.reason = reason;
  }
}

/**
 * Rejects a body that carries module syntax or a dynamic-evaluation escape.
 *
 * This is a deny-list, so it narrows the surface rather than proving safety. The guarantee lives in
 * the renderer: MDX resolves a capitalised tag against the components in scope, and that map holds
 * nothing that evaluates a string. The write path runs this before storing, so a body that could
 * never render is refused at the point the author can still fix it.
 */
export const assertSafeMdx = (source: string): void => {
  for (const { pattern, reason } of FORBIDDEN) {
    if (pattern.test(source)) {
      throw new UnsafeMdxError(reason);
    }
  }
};

/**
 * The write-path form of the same rule: a body the renderer would refuse is answered as a readable
 * `BAD_REQUEST` at the moment the author can still fix it, rather than surfacing as a 500. Every
 * procedure that stores a body calls this one function, so the message and the rule cannot drift.
 */
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
