/**
 * Policy for MDX coming out of the database.
 *
 * Kept separate from the renderer so the decision can be tested without starting the compiler, and
 * so a write path can apply the same rule before a body is ever stored.
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
 * nothing that evaluates a string.
 */
export const assertSafeMdx = (source: string): void => {
  for (const { pattern, reason } of FORBIDDEN) {
    if (pattern.test(source)) {
      throw new UnsafeMdxError(reason);
    }
  }
};
