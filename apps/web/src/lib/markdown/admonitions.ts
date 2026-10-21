/**
 * Expands `:::note|tip|warning|danger [title]` blocks into the `<Admonition>` MDX component.
 *
 * The directives are not MDX, so they are rewritten here, before the compiler sees the body. This
 * keeps the syntax out of the component map (a body can only say `:::note`, never reach an arbitrary
 * component) and keeps the renderer's existing consumers unchanged: a body without a directive is
 * returned byte for byte.
 *
 * The scanner tracks fenced code so an example that shows `:::note` inside a fence stays literal,
 * and an unterminated block still renders (closed at the end of the body) instead of swallowing
 * the rest of the page.
 */
const OPEN = /^:::(?<type>note|tip|warning|danger)(?:\s+(?<title>.*))?$/u;
const CLOSE = /^:::$/u;

const escapeAttribute = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");

export const expandAdmonitions = (source: string): string => {
  const lines = source.split("\n");
  const output: string[] = [];
  let fence: string | null = null;
  let block: { title: string; type: string } | null = null;
  let body: string[] = [];

  const flush = () => {
    if (block === null) {
      return;
    }

    while (body.length > 0 && body[0]?.trim() === "") {
      body.shift();
    }

    while (body.length > 0 && body.at(-1)?.trim() === "") {
      body.pop();
    }

    const title =
      block.title === "" ? "" : ` title="${escapeAttribute(block.title)}"`;

    output.push(
      `<Admonition type="${block.type}"${title}>`,
      "",
      ...body,
      "",
      "</Admonition>",
      ""
    );
    block = null;
    body = [];
  };

  for (const line of lines) {
    const trimmed = line.trimStart();

    if (fence !== null) {
      output.push(line);

      if (trimmed.startsWith(fence)) {
        fence = null;
      }

      continue;
    }

    if (
      block === null &&
      (trimmed.startsWith("```") || trimmed.startsWith("~~~"))
    ) {
      fence = trimmed.slice(0, 3);
      output.push(line);
      continue;
    }

    if (block !== null) {
      if (CLOSE.test(trimmed)) {
        flush();
      } else {
        body.push(line);
      }

      continue;
    }

    const opened = OPEN.exec(trimmed);

    if (opened === null) {
      output.push(line);
      continue;
    }

    block = {
      title: opened.groups?.title?.trim() ?? "",
      type: opened.groups?.type ?? "note",
    };
  }

  flush();

  return output.join("\n");
};
