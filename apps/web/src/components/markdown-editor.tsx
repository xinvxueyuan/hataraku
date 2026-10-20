"use client";

import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  codeBlockPlugin,
  codeMirrorPlugin,
  CreateLink,
  headingsPlugin,
  InsertCodeBlock,
  InsertThematicBreak,
  listsPlugin,
  ListsToggle,
  markdownShortcutPlugin,
  MDXEditor,
  quotePlugin,
  Separator,
  thematicBreakPlugin,
  toolbarPlugin,
  UndoRedo,
} from "@mdxeditor/editor";

import "@mdxeditor/editor/style.css";

/**
 * Languages the code-block picker offers. MDXEditor needs a display name per fence language, and a
 * fence whose language is not listed falls back to a plain block, so the list is explicit.
 */
const CODE_BLOCK_LANGUAGES = {
  bash: "Bash",
  js: "JavaScript",
  json: "JSON",
  text: "Text",
  ts: "TypeScript",
};

/**
 * What the toolbar can insert. Headings, lists, quotes, links, code blocks and thematic breaks cover
 * what this blog publishes; anything else is still reachable by typing Markdown directly.
 */
const PLUGINS = [
  headingsPlugin(),
  listsPlugin(),
  quotePlugin(),
  thematicBreakPlugin(),
  codeBlockPlugin({ defaultCodeBlockLanguage: "text" }),
  codeMirrorPlugin({ codeBlockLanguages: CODE_BLOCK_LANGUAGES }),
  markdownShortcutPlugin(),
  toolbarPlugin({
    toolbarContents: () => (
      <>
        <UndoRedo />
        <Separator />
        <BoldItalicUnderlineToggles />
        <Separator />
        <BlockTypeSelect />
        <ListsToggle />
        <Separator />
        <CreateLink />
        <InsertCodeBlock />
        <InsertThematicBreak />
      </>
    ),
  }),
];

/**
 * The Markdown editor.
 *
 * Loaded on demand with `ssr: false` from `post-editor`: Lexical and CodeMirror are large and only
 * run in the browser, so the admin list page never pays for them. The editor reads and writes plain
 * Markdown, which is exactly what the renderer compiles — no JSX, no component props.
 */
export const MarkdownEditor = ({
  onChange,
  value,
}: {
  onChange: (markdown: string) => void;
  value: string;
}) => (
  <MDXEditor
    contentEditableClassName="prose prose-neutral dark:prose-invert max-w-none min-h-[22rem] px-4 py-3 focus:outline-none"
    markdown={value}
    onChange={onChange}
    plugins={PLUGINS}
  />
);
