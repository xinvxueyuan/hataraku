#!/usr/bin/env node
/* oxlint-disable typescript/no-unsafe-argument, typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-return, typescript/strict-boolean-expressions */
/**
 * Design-system guardrails.
 *
 * Three rules:
 *   1. No hardcoded design values (raw colours, arbitrary value utilities) in the design system or
 *      the app. The token stylesheet is the source of truth; exceptions are explicit below.
 *   2. Package boundaries: @hataraku/ui and @hataraku/components must not reach into Next, the
 *      server packages, or apps. Packages must never import application source.
 *   3. Styles have one entry per package. Stylesheet imports are allowed only at that entry and in
 *      apps through the package export.
 *
 * Dependency-free on purpose: CI runs it after vp check and before tests.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
// oxlint-disable-next-line unicorn/import-style -- named imports are the bound node:path functions
import { dirname, extname, join, relative, resolve, sep } from "node:path";

const ROOT = process.cwd();
const toPosix = (value) => value.split(sep).join("/");
const relativePath = (value) => toPosix(relative(ROOT, value));

const SCAN_ROOTS = [
  "packages/ui/src",
  "packages/components/src",
  "apps/web/src",
];

const SKIP_DIRS = new Set([
  ".next",
  ".turbo",
  ".velite",
  "coverage",
  "dist",
  "node_modules",
]);

const TEXT_EXTENSIONS = new Set([".css", ".js", ".jsx", ".mjs", ".ts", ".tsx"]);

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

const readJson = (path) =>
  existsSync(path) ? JSON.parse(readFileSync(path, "utf-8")) : null;

const packageFile = (packageRoot) => join(ROOT, packageRoot, "package.json");

const violations = [];
const notes = [];

const addViolation = (file, line, column, message) => {
  violations.push(`${relativePath(file)}:${line}:${column} ${message}`);
};

const addNote = (message) => {
  notes.push(message);
};

// Raw colours are allowed only where they are the source of truth (the token stylesheet) or where
// a runtime cannot consume tokens: satori renders the OG card from inline styles, with no Tailwind
// or CSS-variable pipeline.
const COLOR_ALLOWED_FILES = new Set(["apps/web/src/app/api/og/route.tsx"]);
const TOKEN_STYLE_DIRECTORY = "packages/ui/src/styles/";

// Existing value utilities kept as explicit exceptions while their owner tokenises them. Each
// entry names the file and the exact class, so a new hardcoded value nearby still fails.
const VALUE_ALLOWLIST = [
  {
    file: "packages/ui/src/components/button.tsx",
    match: "text-[0.8rem]",
    reason: "compact control type scale; H53 owns the token replacement",
  },
  {
    file: "packages/ui/src/components/checkbox.tsx",
    match: "rounded-[4px]",
    reason: "checkbox corner geometry; H53 owns the token replacement",
  },
  {
    file: "packages/ui/src/components/dropdown-menu.tsx",
    match: "min-w-[96px]",
    reason: "menu minimum width geometry; H53 owns the token replacement",
  },
  {
    file: "apps/web/src/components/admin-page-shell.tsx",
    match: "w-[min(56rem,calc(100vw-2rem))]",
    reason: "responsive shell width is layout geometry, not a theme value",
  },
  {
    file: "apps/web/src/components/sheet.tsx",
    match: "h-[420px]",
    reason: "fixed Univer canvas height is structural",
  },
  {
    file: "packages/ui/src/components/badge.tsx",
    match: "ring-[3px]",
    reason: "focus-ring width; H53 owns the token replacement",
  },
  {
    file: "apps/web/src/components/admin-nav.tsx",
    match: "max-w-[calc(100vw-2rem)]",
    reason: "responsive drawer width is layout geometry, not a theme value",
  },
];

// Geometry utilities are allowed anywhere: they place content and do not carry the visual theme.
const STRUCTURAL_PREFIXES = new Set([
  "aspect",
  "bottom",
  "col-span",
  "grid-cols",
  "grid-rows",
  "inset",
  "inset-x",
  "inset-y",
  "left",
  "max-h",
  "min-h",
  "order",
  "right",
  "rotate",
  "row-span",
  "scale",
  "top",
  "translate-x",
  "translate-y",
]);

// Value utilities that must resolve through a token.
const VALUE_PREFIXES = new Set([
  "basis",
  "bg",
  "border",
  "border-b",
  "border-l",
  "border-r",
  "border-t",
  "fill",
  "font",
  "gap",
  "gap-x",
  "gap-y",
  "h",
  "leading",
  "m",
  "max-w",
  "mb",
  "ml",
  "mr",
  "mt",
  "mx",
  "my",
  "min-w",
  "outline",
  "p",
  "pb",
  "pl",
  "pr",
  "pt",
  "px",
  "py",
  "ring",
  "rounded",
  "shadow",
  "size",
  "space-x",
  "space-y",
  "stroke",
  "text",
  "tracking",
  "w",
  "z",
]);

const COLOR_PATTERN = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|lab)\(/gu;

// The probe must not be the global regex: test() would advance its lastIndex between lines.
const COLOR_PROBE = new RegExp(COLOR_PATTERN.source, "u");

const ARBITRARY_VALUE_PATTERN =
  /(?:^|[\s"':\u0060])(?<dash>-?)(?<prefix>[a-z][a-z0-9-]*)-\[(?<content>[^\]]+)\]/gu;

const IMPORT_PATTERN =
  /(?:from\s*|import\s*\(\s*|require\s*\(\s*|import\s+)["'](?<specifier>[^"']+)["']/gu;

const CSS_IMPORT_PATTERN =
  /(?:import\s+["'](?<module>[^"']+\.css)["']|@import\s+["'](?<sheet>[^"']+\.css)["'])/gu;

const isCommentLine = (line) => {
  const trimmed = line.trim();

  return ["//", "*", "/*"].some((prefix) => trimmed.startsWith(prefix));
};

const isTokenStylesheet = (filePath) =>
  filePath.startsWith(TOKEN_STYLE_DIRECTORY) && filePath.endsWith(".css");

const scanColours = (file, line, lineNumber) => {
  for (const match of line.matchAll(COLOR_PATTERN)) {
    addViolation(
      file,
      lineNumber,
      (match.index ?? 0) + 1,
      `hardcoded colour ${match[0]} - use a semantic token`
    );
  }
};

const scanArbitraryValues = (file, filePath, line, lineNumber) => {
  for (const match of line.matchAll(ARBITRARY_VALUE_PATTERN)) {
    const prefix = match.groups?.prefix ?? "";
    const content = match.groups?.content ?? "";

    if (!VALUE_PREFIXES.has(prefix) && !STRUCTURAL_PREFIXES.has(prefix)) {
      continue;
    }

    const literal = `${prefix}-[${content}]`;
    const column = (match.index ?? 0) + match[0].indexOf(prefix) + 1;

    if (content.includes("var(") || content.includes("--")) {
      addNote(
        `allow ${filePath}:${lineNumber} ${literal} - token-derived expression`
      );
      continue;
    }

    if (STRUCTURAL_PREFIXES.has(prefix)) {
      addNote(
        `allow ${filePath}:${lineNumber} ${
          literal
        } - layout geometry, not a theme value`
      );
      continue;
    }

    const exception = VALUE_ALLOWLIST.find(
      (entry) => entry.file === filePath && line.includes(entry.match)
    );

    if (exception !== undefined) {
      addNote(
        `allow ${filePath}:${lineNumber} ${literal} - ${exception.reason}`
      );
      continue;
    }

    addViolation(
      file,
      lineNumber,
      column,
      `hardcoded design value ${
        literal
      } - use a token utility or add an explicit exception to scripts/check-design.mjs`
    );
  }
};

const scanLine = (
  file,
  filePath,
  line,
  lineNumber,
  colorAllowed,
  tokenStylesheet
) => {
  if (isCommentLine(line)) {
    return;
  }

  if (!colorAllowed) {
    scanColours(file, line, lineNumber);
  }

  if (tokenStylesheet || extname(file) === ".css") {
    return;
  }

  scanArbitraryValues(file, filePath, line, lineNumber);
};

const scanHardcodedValues = () => {
  for (const root of SCAN_ROOTS) {
    for (const file of walk(join(ROOT, root))) {
      const filePath = relativePath(file);
      const tokenStylesheet = isTokenStylesheet(filePath);

      const colorAllowed = [
        tokenStylesheet,
        COLOR_ALLOWED_FILES.has(filePath),
      ].some(Boolean);

      const lines = readFileSync(file, "utf-8").split(/\r?\n/u);

      if (colorAllowed && lines.some((line) => COLOR_PROBE.test(line))) {
        addNote(`allow ${filePath} - raw colours are declared here`);
      }

      for (const [index, line] of lines.entries()) {
        scanLine(
          file,
          filePath,
          line,
          index + 1,
          colorAllowed,
          tokenStylesheet
        );
      }
    }
  }
};

const FORBIDDEN_IMPORTS = [
  /^next(?:\/|$)/u,
  /^@hataraku\/(?:api|db|auth)(?:\/|$)/u,
  /^apps(?:\/|$)/u,
];

const isForbiddenImport = (specifier, packageRoot) => {
  if (FORBIDDEN_IMPORTS.some((pattern) => pattern.test(specifier))) {
    return true;
  }

  return (
    packageRoot === "packages/ui" &&
    /^@hataraku\/components(?:\/|$)/u.test(specifier)
  );
};

const packageRoots = () => {
  const roots = [];

  for (const parent of [join(ROOT, "apps"), join(ROOT, "packages")]) {
    if (!existsSync(parent)) {
      continue;
    }

    for (const entry of readdirSync(parent, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }

      const root = join(parent, entry.name);

      if (existsSync(packageFile(relativePath(root)))) {
        roots.push(relativePath(root));
      }
    }
  }

  return roots;
};

const scanImportsIn = (file) => {
  const lines = readFileSync(file, "utf-8").split(/\r?\n/u);
  const imports = [];

  for (let index = 0; index < lines.length; index += 1) {
    for (const match of lines[index].matchAll(IMPORT_PATTERN)) {
      imports.push({
        column: (match.index ?? 0) + 1,
        line: index + 1,
        specifier: match.groups?.specifier ?? "",
      });
    }
  }

  return imports;
};

const BOUNDARY_PACKAGES = new Set(["packages/components", "packages/ui"]);

const scanDependencyBoundaries = () => {
  const sections = [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
  ];

  for (const packageRoot of packageRoots()) {
    if (!packageRoot.startsWith("packages/")) {
      continue;
    }

    const manifestPath = packageFile(packageRoot);
    const manifest = readJson(manifestPath);

    if (BOUNDARY_PACKAGES.has(packageRoot)) {
      for (const section of sections) {
        for (const [name, value] of Object.entries(manifest[section] ?? {})) {
          if (isForbiddenImport(name, packageRoot)) {
            addViolation(
              manifestPath,
              1,
              1,
              `package boundary: ${packageRoot} must not depend on ${name} (${
                section
              }, ${value})`
            );
          }
        }
      }
    }

    for (const file of walk(join(ROOT, packageRoot, "src"))) {
      for (const imported of scanImportsIn(file)) {
        if (
          BOUNDARY_PACKAGES.has(packageRoot) &&
          isForbiddenImport(imported.specifier, packageRoot)
        ) {
          addViolation(
            file,
            imported.line,
            imported.column,
            `package boundary: ${packageRoot} imports ${imported.specifier}`
          );
          continue;
        }

        if (imported.specifier.startsWith(".")) {
          const resolvedPath = relativePath(
            resolve(dirname(file), imported.specifier)
          );

          if (resolvedPath === "apps" || resolvedPath.startsWith("apps/")) {
            addViolation(
              file,
              imported.line,
              imported.column,
              `package boundary: ${packageRoot} imports application source ${
                resolvedPath
              }`
            );
          }
        }
      }
    }
  }
};

const packageStyleEntries = (packageRoot) => {
  const manifest = readJson(packageFile(packageRoot));

  if (manifest === null) {
    return [];
  }

  const entries = [];

  for (const value of Object.values(manifest.exports ?? {})) {
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- package.json is untyped JSON; this string check is its boundary guard
    if (typeof value === "string" && value.endsWith(".css")) {
      entries.push(resolve(ROOT, packageRoot, value));
    }
  }

  return entries;
};

const scanPackageStyles = (packageRoot) => {
  const manifestPath = packageFile(packageRoot);

  if (!existsSync(manifestPath)) {
    addNote(
      `skip: ${
        packageRoot
      } is not present yet; its dependency and CSS-entry checks run once the package lands.`
    );

    return;
  }

  const entries = packageStyleEntries(packageRoot);

  if (entries.length > 1) {
    addViolation(
      manifestPath,
      1,
      1,
      `styles: ${packageRoot} exports ${
        entries.length
      } stylesheet entries; one entry per package`
    );
  }

  for (const cssFile of walk(join(ROOT, packageRoot, "src"))) {
    if (extname(cssFile) !== ".css") {
      continue;
    }

    const filePath = relativePath(cssFile);
    const inStyleDirectory = filePath.startsWith(`${packageRoot}/src/styles/`);

    if (!entries.includes(cssFile) && !inStyleDirectory) {
      addViolation(
        cssFile,
        1,
        1,
        `styles: ${packageRoot} has a stylesheet outside the single entry`
      );
    }
  }

  for (const file of walk(join(ROOT, packageRoot, "src"))) {
    if (extname(file) === ".css") {
      continue;
    }

    const lines = readFileSync(file, "utf-8").split(/\r?\n/u);

    for (let index = 0; index < lines.length; index += 1) {
      for (const match of lines[index].matchAll(CSS_IMPORT_PATTERN)) {
        addViolation(
          file,
          index + 1,
          (match.index ?? 0) + 1,
          `styles: ${packageRoot} imports a stylesheet from a component (${
            match.groups?.module ?? match.groups?.sheet ?? ""
          })`
        );
      }
    }
  }
};

const scanAppStyles = () => {
  const appRoot = join(ROOT, "apps/web/src");

  if (!existsSync(appRoot)) {
    return;
  }

  const entries = [];

  for (const file of walk(appRoot)) {
    for (const imported of scanImportsIn(file)) {
      if (imported.specifier === "@hataraku/ui/globals.css") {
        entries.push(`${relativePath(file)}:${imported.line}`);
      }
    }
  }

  if (entries.length === 1) {
    addNote(`allow ${entries[0]} - the single application stylesheet entry`);
  } else {
    addViolation(
      appRoot,
      1,
      1,
      `styles: apps/web must import @hataraku/ui/globals.css exactly once; found ${
        entries.length
      } (${entries.join(", ")})`
    );
  }
};

const scanStylesheetEntries = () => {
  for (const packageRoot of ["packages/ui", "packages/components"]) {
    scanPackageStyles(packageRoot);
  }

  scanAppStyles();
};

scanHardcodedValues();

scanDependencyBoundaries();

scanStylesheetEntries();

for (const note of notes) {
  console.log(note);
}

if (violations.length > 0) {
  for (const violation of violations) {
    console.error(violation);
  }

  console.error(`design check failed: ${violations.length} violation(s)`);
  process.exitCode = 1;
} else {
  console.log("design check passed.");
}
