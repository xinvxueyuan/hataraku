import type { ReactNode } from "react";

import {
  Info,
  Lightbulb,
  OctagonAlert,
  TriangleAlert,
} from "@hataraku/ui/icons";

/**
 * A `:::note`-family callout.
 *
 * The type, title, and children arrive as strings and nodes from the MDX body; nothing here
 * evaluates text. Titles keep the foreground colour and only the icon carries the accent, so the
 * label measures the same contrast as body copy in both themes.
 *
 * Icons come from the design system's reviewed set, not from an icon library directly: which glyph
 * a warning uses is an appearance decision, and this package only depends on @hataraku/ui + react.
 */
const VARIANTS = {
  danger: {
    className: "border-destructive/60 bg-destructive/10",
    icon: OctagonAlert,
    iconClassName: "text-destructive",
    label: "危险",
  },
  note: {
    className: "border-border bg-muted/60",
    icon: Info,
    iconClassName: "text-muted-foreground",
    label: "说明",
  },
  tip: {
    className: "border-primary/40 bg-primary/5",
    icon: Lightbulb,
    iconClassName: "text-primary",
    label: "提示",
  },
  warning: {
    className: "border-destructive/40 bg-destructive/5",
    icon: TriangleAlert,
    iconClassName: "text-destructive",
    label: "注意",
  },
} as const;

export type AdmonitionType = keyof typeof VARIANTS;

const isAdmonitionType = (value: string): value is AdmonitionType =>
  Object.hasOwn(VARIANTS, value);

interface AdmonitionProps {
  children?: ReactNode;
  /** Override the default label per type (the caller owns the language/copy). */
  labels?: Partial<Record<AdmonitionType, string>>;
  title?: string;
  type?: string;
}

export const Admonition = ({
  children,
  labels,
  title,
  type = "note",
}: AdmonitionProps) => {
  const resolved = isAdmonitionType(type) ? type : "note";
  const variant = VARIANTS[resolved];
  const Icon = variant.icon;

  const label =
    title === undefined || title === ""
      ? (labels?.[resolved] ?? variant.label)
      : title;

  return (
    <aside
      className={`my-6 flex gap-3 rounded-lg border border-l-4 px-4 py-3 ${variant.className}`}
      data-admonition={resolved}
    >
      <Icon
        aria-hidden="true"
        className={`mt-0.5 size-5 shrink-0 ${variant.iconClassName}`}
      />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-medium">{label}</p>
        <div className="text-sm leading-relaxed">{children}</div>
      </div>
    </aside>
  );
};
