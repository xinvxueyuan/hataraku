/**
 * Markdown to running text for the search index.
 *
 * The index stores what a reader can see, not the source: headings, emphasis markers, link URLs,
 * table pipes, code fences and horizontal rules are presentation. Snippets are cut from this text,
 * so markup can never leak into a result card.
 *
 * This is intentionally not a renderer. It keeps the link label and image alt text, the text inside
 * code spans and fences, and plain HTML that the renderer would show as text.
 */
const RULES: readonly (readonly [RegExp, string])[] = [
  // HTML comments and fenced code markers (the body between fences is kept).
  [/<!--[\s\S]*?-->/gu, ""],
  [/^\s*(?:\u0060{3}|~~~)[^\n]*$/gmu, ""],
  // Images keep their alt text; links keep their label.
  [/!\[(?<alt>[^\]]*)\]\((?:[^()]|\([^()]*\))*\)/gu, "$<alt>"],
  [/\[(?<label>[^\]]*)\]\((?:[^()]|\([^()]*\))*\)/gu, "$<label>"],
  [/\[(?<label>[^\]]+)\]\[[^\]]*\]/gu, "$<label>"],
  [/^\s*\[[^\]]+\]:\s+\S+.*$/gmu, ""],
  [/<(?<url>(?:https?|mailto):[^>\s]+)>/gu, "$<url>"],
  // Block structure.
  [/^\s{0,3}#{1,6}\s+/gmu, ""],
  [/^\s{0,3}>\s?/gmu, ""],
  [/^\s{0,3}(?:[-*+]|\d+\.)\s+/gmu, ""],
  [/^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/gmu, ""],
  [/^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$/gmu, ""],
  [/\|/gu, " "],
  // Inline code markers; the code text itself stays.
  [/\u0060+/gu, ""],
  // Emphasis and strikethrough pairs.
  [/\*\*(?<text>.+?)\*\*/gu, "$<text>"],
  [/__(?<text>.+?)__/gu, "$<text>"],
  [/(?<![\p{L}\p{N}*])\*(?<text>[^*\n]+?)\*(?![\p{L}\p{N}*])/gu, "$<text>"],
  [/(?<![\p{L}\p{N}])_(?<text>[^_\n]+?)_(?![\p{L}\p{N}])/gu, "$<text>"],
  [/~~(?<text>.+?)~~/gu, "$<text>"],
  // Leftovers that would still read as source.
  [/-{3,}/gu, " "],
  [/\*\*/gu, ""],
  [/__/gu, ""],
  [/\][(]/gu, " "],
  [/\s+/gu, " "],
];

export const markdownToPlainText = (markdown: string): string => {
  let text = markdown;

  for (const [pattern, replacement] of RULES) {
    text = text.replaceAll(pattern, replacement);
  }

  return text.trim();
};
