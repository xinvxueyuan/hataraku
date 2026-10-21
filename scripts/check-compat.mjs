#!/usr/bin/env node
/* oxlint-disable typescript/no-unsafe-argument, typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-return, typescript/strict-boolean-expressions */
/**
 * Compatibility guardrails.
 *
 * A compatibility path is allowed only for a verified external constraint — a deployed consumer, a
 * persisted format, a staged rollout. It must live in one module and leave nothing behind in live
 * code, so removing it is one directory delete plus a grep that returns zero.
 *
 * Three rules:
 *   1. Compatibility markers (compat, legacy, backward, deprecated, LEGACY_) appear only inside
 *      apps/web/src/compat/ or packages/compat/. Anywhere else in source is a violation.
 *   2. A module that exists ships REMOVAL.md (or a header comment on its entry file) that names
 *      the constraint and the condition that removes it.
 *   3. Every import of the module carries `// compat: <constraint it serves>` on its line or on the
 *      line above, so the reason travels with the call site.
 *
 * Markers are matched as name segments, not prose: `legacyPostsHref` and `LEGACY_IMPORT` match,
 * the word "compatibility" in a sentence does not. Quoted strings are masked before the scan so an
 * import specifier like "#compat/x" is not itself read as a marker.
 *
 * Dependency-free on purpose: CI runs it right after the design-system check.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
// oxlint-disable-next-line unicorn/import-style -- named imports are the bound node:path functions
import { extname, join, relative, sep } from "node:path";

const ROOT = process.cwd();
const toPosix = (value) => value.split(sep).join("/");
const relativePath = (value) => toPosix(relative(ROOT, value));

/** The only two places compatibility code may live. */
const COMPAT_MODULES = ["apps/web/src/compat", "packages/compat"];

const SKIP_DIRS = new Set([
  ".next",
  ".turbo",
  ".velite",
  "coverage",
  "dist",
  "node_modules",
]);

const TEXT_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx"]);

/**
 * Paths that may mention compatibility without being compatibility code. The scanner never walks
 * most of them (it only reads source roots), but the list is printed so the boundary is explicit:
 * documentation, the rule itself, release history, generated SQL and evidence are not source.
 */
const ALLOWED_PATHS = [
  {
    path: "docs/",
    reason: "documentation may explain a compatibility path",
  },
  { path: "artifacts/", reason: "historical evidence, not source" },
  { path: "AGENTS.md", reason: "the rule itself" },
  { path: "CHANGELOG", reason: "release history" },
  {
    path: "packages/db/src/migrations/",
    reason: "generated SQL keeps its historical naming",
  },
  ...COMPAT_MODULES.map((compatModule) => ({
    path: `${compatModule}/`,
    reason: "the compatibility module itself",
  })),
];

/**
 * Known, transient compatibility sites in live code. Each entry is printed on every run, and an
 * entry that no longer matches anything fails the check, so the exception cannot outlive the code
 * it was written for.
 */
const SOURCE_ALLOWLIST = [];

const violations = [];
const notes = [];
const usedAllowlistEntries = new Set();

const addViolation = (file, line, column, message) => {
  violations.push(`${relativePath(file)}:${line}:${column} ${message}`);
};

const addNote = (message) => {
  notes.push(message);
};

const isCompatModuleFile = (file) =>
  COMPAT_MODULES.some((module) => {
    const prefix = join(ROOT, module) + sep;

    return file.startsWith(prefix);
  });

const allowedBy = (file) => {
  const path = relativePath(file);

  return ALLOWED_PATHS.find(
    (entry) => path === entry.path || path.startsWith(entry.path)
  );
};

const walk = (directory) => {
  if (!existsSync(directory)) {
    return [];
  }

  const files = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name);

    if (entry.isDirectory()) {
      if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) {
        continue;
      }

      files.push(...walk(full));
      continue;
    }

    if (TEXT_EXTENSIONS.has(extname(entry.name))) {
      files.push(full);
    }
  }

  return files;
};

/** apps/web/src plus every packages/<name>/src that exists. */
const sourceRoots = () => {
  const roots = [join(ROOT, "apps/web/src")];
  const packages = join(ROOT, "packages");

  if (!existsSync(packages)) {
    return roots;
  }

  for (const entry of readdirSync(packages, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const src = join(packages, entry.name, "src");

    if (existsSync(src) && statSync(src).isDirectory()) {
      roots.push(src);
    }
  }

  return roots;
};

const MARKER_PATTERN =
  /(?<![A-Za-z])(?:[Cc]ompat|[Ll]egacy|[Bb]ackward|[Dd]eprecated|LEGACY_)(?![a-z])/gu;

/** Replaces quoted strings with spaces so specifiers cannot match a marker, keeping columns. */
const maskStrings = (line) =>
  line.replaceAll(/"[^"]*"|'[^']*'|`[^`]*`/gu, (match) =>
    " ".repeat(match.length)
  );

const maskAnnotation = (line) =>
  line.replace(/\/\/\s*compat:.*$/u, (match) => " ".repeat(match.length));

const scanMarkers = (file, lines, annotationLines) => {
  for (let index = 0; index < lines.length; index += 1) {
    const source = annotationLines.has(index)
      ? maskAnnotation(lines[index])
      : lines[index];

    const masked = maskStrings(source);

    for (const match of masked.matchAll(MARKER_PATTERN)) {
      const allowlistIndex = SOURCE_ALLOWLIST.findIndex(
        (entry, entryIndex) =>
          !usedAllowlistEntries.has(entryIndex) &&
          entry.file === relativePath(file) &&
          lines[index].includes(entry.match)
      );

      if (allowlistIndex !== -1) {
        const entry = SOURCE_ALLOWLIST[allowlistIndex];
        usedAllowlistEntries.add(allowlistIndex);
        addNote(
          `allow ${relativePath(file)}:${index + 1} marker "${match[0]}" - ${entry.reason}`
        );
        continue;
      }

      addViolation(
        file,
        index + 1,
        (match.index ?? 0) + 1,
        `compat: marker "${match[0]}" outside the compatibility module - move it into ${COMPAT_MODULES.join(
          " or "
        )}, or delete the path`
      );
    }
  }
};

const IMPORT_PATTERN =
  /(?:from\s*|import\s*\(\s*|require\s*\(\s*|import\s+)["'](?<specifier>[^"']+)["']/gu;

const COMPAT_SPECIFIER =
  /^(?:@hataraku\/compat(?:\/.*)?|#compat(?:\/.*)?|#src\/compat(?:\/.*)?|(?:\.{1,2}\/)+compat(?:\/.*)?)$/u;

const ANNOTATION = /\/\/\s*compat:\s*\S/u;

const scanImports = (file, lines, annotationLines) => {
  for (let index = 0; index < lines.length; index += 1) {
    for (const match of lines[index].matchAll(IMPORT_PATTERN)) {
      const specifier = match.groups?.specifier ?? "";

      if (!COMPAT_SPECIFIER.test(specifier)) {
        continue;
      }

      const previous = index > 0 ? lines[index - 1] : "";
      const annotatedOnImport = ANNOTATION.test(lines[index]);
      const annotatedAbove = ANNOTATION.test(previous);

      if (annotatedOnImport) {
        annotationLines.add(index);
      }

      if (annotatedAbove && index > 0) {
        annotationLines.add(index - 1);
      }

      if (!(annotatedOnImport || annotatedAbove)) {
        addViolation(
          file,
          index + 1,
          (match.index ?? 0) + 1,
          `compat: import "${specifier}" has no "// compat: <constraint>" comment on its line or the line above`
        );
      }
    }
  }
};

const readIfExists = (path) =>
  existsSync(path) ? readFileSync(path, "utf-8") : null;

/** A module must state what it is for and what removes it. */
const scanModuleDeclaration = () => {
  const present = COMPAT_MODULES.filter((module) =>
    existsSync(join(ROOT, module))
  );

  if (present.length === 0) {
    addNote(
      "allow no compatibility module — nothing to declare (add one only for a verified external constraint)"
    );

    return;
  }

  for (const compatModule of present) {
    const directory = join(ROOT, compatModule);
    const removal = readIfExists(join(directory, "REMOVAL.md"));

    const entry = ["index.ts", "index.tsx", "index.js"]
      .map((name) => join(directory, name))
      .find((path) => existsSync(path));

    const text =
      removal ?? (entry === undefined ? "" : (readIfExists(entry) ?? ""));

    const hasConstraint = /(?:constraint|约束)/iu.test(text);
    const hasRemoval = /(?:removal|remove|移除|删除)/iu.test(text);

    if (removal === null && entry === undefined) {
      addViolation(
        directory,
        1,
        1,
        `compat: ${compatModule} exists without REMOVAL.md (and without an entry file header) — state the constraint and the removal condition`
      );
      continue;
    }

    if (!(hasConstraint && hasRemoval)) {
      addViolation(
        directory,
        1,
        1,
        `compat: ${compatModule} must name both the constraint and the removal condition (REMOVAL.md or the entry file header)`
      );
      continue;
    }

    addNote(
      `allow ${compatModule}/ - compatibility module; constraint and removal condition declared`
    );
  }
};

for (const entry of ALLOWED_PATHS) {
  addNote(`allow ${entry.path} - ${entry.reason}`);
}

scanModuleDeclaration();

let scanned = 0;

for (const root of sourceRoots()) {
  for (const file of walk(root)) {
    if (isCompatModuleFile(file)) {
      continue;
    }

    const allowed = allowedBy(file);

    if (allowed !== undefined) {
      addNote(`allow ${relativePath(file)} - ${allowed.reason}`);
      continue;
    }

    scanned += 1;
    const lines = readFileSync(file, "utf-8").split(/\r?\n/u);

    const annotationLines = new Set();
    scanImports(file, lines, annotationLines);
    scanMarkers(file, lines, annotationLines);
  }
}

for (const [index, entry] of SOURCE_ALLOWLIST.entries()) {
  if (!usedAllowlistEntries.has(index)) {
    addViolation(
      join(ROOT, entry.file),
      1,
      1,
      `compat: stale allowlist entry for ${entry.file} ("${entry.match}") no longer matches anything - delete the entry`
    );
  }
}

for (const note of notes) {
  console.log(note);
}

if (violations.length > 0) {
  for (const violation of violations) {
    console.error(violation);
  }

  console.error(
    `compatibility check failed: ${violations.length} violation(s) in ${scanned} source file(s)`
  );
  process.exitCode = 1;
} else {
  console.log(
    `compatibility check passed: ${scanned} source file(s), no compatibility code outside the module.`
  );
}
