"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SubmitEvent } from "react";

import { Input } from "@hataraku/ui/components/input";
import { Label } from "@hataraku/ui/components/label";

import {
  FormActions,
  FormFailure,
  firstFailure,
} from "#src/components/admin-form-parts.tsx";
import { api } from "#src/lib/api.ts";

/** The social entries the about page knows how to label; an unknown key would render as itself. */
const SOCIAL_KEYS = [
  "github",
  "twitter",
  "bilibili",
  "weibo",
  "zhihu",
] as const;

const SOCIAL_LABELS = new Map<string, string>([
  ["bilibili", "哔哩哔哩"],
  ["github", "GitHub"],
  ["twitter", "Twitter / X"],
  ["weibo", "微博"],
  ["zhihu", "知乎"],
]);

type SocialKey = (typeof SOCIAL_KEYS)[number];

/**
 * The profile row as the form needs it. Declared here rather than imported from the server module
 * so the client bundle never pulls in `server-only`.
 */
export interface EditableSiteProfile {
  author: string | null;
  avatarUrl: string | null;
  description: string | null;
  email: string | null;
  hero: {
    badge?: string;
    cta?: string;
    ctaHref?: string;
    description?: string;
    meta?: string;
    title?: string;
  } | null;
  name: string;
  nameEn: string | null;
  social: Record<string, string> | null;
  tagline: string | null;
}

interface ProfileForm {
  author: string;
  avatarUrl: string;
  description: string;
  email: string;
  hero: {
    badge: string;
    cta: string;
    ctaHref: string;
    description: string;
    meta: string;
    title: string;
  };
  name: string;
  nameEn: string;
  social: Record<SocialKey, string>;
  tagline: string;
}

const emptySocial = (): Record<SocialKey, string> => ({
  bilibili: "",
  github: "",
  twitter: "",
  weibo: "",
  zhihu: "",
});

/** An absent column and an empty box are the same thing to a form. */
const orEmpty = (value: string | null | undefined): string => value ?? "";

const initialForm = (profile: EditableSiteProfile | null): ProfileForm => {
  if (profile === null) {
    return {
      author: "",
      avatarUrl: "",
      description: "",
      email: "",
      hero: {
        badge: "",
        cta: "",
        ctaHref: "",
        description: "",
        meta: "",
        title: "",
      },
      name: "",
      nameEn: "",
      social: emptySocial(),
      tagline: "",
    };
  }

  // Read once, so the object literal below has no optional-chain branches of its own.
  const hero = profile.hero ?? {};
  const stored = profile.social ?? {};
  const social = emptySocial();

  for (const key of SOCIAL_KEYS) {
    social[key] = orEmpty(stored[key]);
  }

  return {
    author: orEmpty(profile.author),
    avatarUrl: orEmpty(profile.avatarUrl),
    description: orEmpty(profile.description),
    email: orEmpty(profile.email),
    hero: {
      badge: orEmpty(hero.badge),
      cta: orEmpty(hero.cta),
      ctaHref: orEmpty(hero.ctaHref),
      description: orEmpty(hero.description),
      meta: orEmpty(hero.meta),
      title: orEmpty(hero.title),
    },
    name: profile.name,
    nameEn: orEmpty(profile.nameEn),
    social,
    tagline: orEmpty(profile.tagline),
  };
};

const FIELD = "grid gap-2";

/**
 * The site profile editor: identity, social links and the home hero.
 *
 * Every box is a string, and an empty box is how the owner clears a value — the procedure stores
 * NULL and the readers fall back to their constants. Saving refreshes the route, so the header,
 * the footer and this page re-read the row instead of showing the values they were rendered with.
 */
export const SiteProfileForm = ({
  profile,
}: {
  profile: EditableSiteProfile | null;
}) => {
  const router = useRouter();
  const [form, setForm] = useState<ProfileForm>(() => initialForm(profile));
  const [saved, setSaved] = useState(false);

  const patch = (changes: Partial<Omit<ProfileForm, "hero" | "social">>) => {
    setSaved(false);
    setForm((previous) => ({ ...previous, ...changes }));
  };

  const patchHero = (changes: Partial<ProfileForm["hero"]>) => {
    setSaved(false);
    setForm((previous) => ({
      ...previous,
      hero: { ...previous.hero, ...changes },
    }));
  };

  const patchSocial = (key: SocialKey, value: string) => {
    setSaved(false);
    setForm((previous) => ({
      ...previous,
      social: { ...previous.social, [key]: value },
    }));
  };

  const update = useMutation(
    api.site.updateProfile.mutationOptions({
      onSuccess: () => {
        setSaved(true);
        router.refresh();
      },
    })
  );

  const save = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    update.mutate(form);
  };

  return (
    <form className="grid gap-5" onSubmit={save}>
      <fieldset className="grid gap-4 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">站点资料</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={FIELD}>
            <Label htmlFor="site-name">站点名</Label>
            <Input
              id="site-name"
              onChange={(event) => {
                patch({ name: event.target.value });
              }}
              required
              value={form.name}
            />
          </div>
          <div className={FIELD}>
            <Label htmlFor="site-name-en">站点名（英文）</Label>
            <Input
              id="site-name-en"
              onChange={(event) => {
                patch({ nameEn: event.target.value });
              }}
              value={form.nameEn}
            />
          </div>
          <div className={FIELD}>
            <Label htmlFor="site-tagline">副标题</Label>
            <Input
              id="site-tagline"
              onChange={(event) => {
                patch({ tagline: event.target.value });
              }}
              value={form.tagline}
            />
          </div>
          <div className={FIELD}>
            <Label htmlFor="site-author">作者</Label>
            <Input
              id="site-author"
              onChange={(event) => {
                patch({ author: event.target.value });
              }}
              value={form.author}
            />
          </div>
          <div className={FIELD}>
            <Label htmlFor="site-email">联系邮箱</Label>
            <Input
              id="site-email"
              onChange={(event) => {
                patch({ email: event.target.value });
              }}
              type="email"
              value={form.email}
            />
          </div>
          <div className={FIELD}>
            <Label htmlFor="site-avatar-url">头像地址</Label>
            <Input
              id="site-avatar-url"
              onChange={(event) => {
                patch({ avatarUrl: event.target.value });
              }}
              placeholder="https://…"
              value={form.avatarUrl}
            />
          </div>
          <div className={`${FIELD} sm:col-span-2`}>
            <Label htmlFor="site-description">站点描述</Label>
            <textarea
              className="border-input bg-background min-h-20 rounded-md border px-3 py-2 text-sm"
              id="site-description"
              onChange={(event) => {
                patch({ description: event.target.value });
              }}
              value={form.description}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="grid gap-4 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">社交链接</legend>
        <p className="text-muted-foreground text-xs">
          只接受 http(s) 地址；留空即从「关于」页移除。
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {SOCIAL_KEYS.map((key) => (
            <div className={FIELD} key={key}>
              <Label htmlFor={`social-${key}`}>{SOCIAL_LABELS.get(key)}</Label>
              <Input
                id={`social-${key}`}
                onChange={(event) => {
                  patchSocial(key, event.target.value);
                }}
                placeholder="https://…"
                value={form.social[key]}
              />
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset className="grid gap-4 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">首页 Hero</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={FIELD}>
            <Label htmlFor="hero-badge">徽标</Label>
            <Input
              id="hero-badge"
              onChange={(event) => {
                patchHero({ badge: event.target.value });
              }}
              value={form.hero.badge}
            />
          </div>
          <div className={FIELD}>
            <Label htmlFor="hero-title">主标题</Label>
            <Input
              id="hero-title"
              onChange={(event) => {
                patchHero({ title: event.target.value });
              }}
              value={form.hero.title}
            />
          </div>
          <div className={FIELD}>
            <Label htmlFor="hero-cta">CTA 文案</Label>
            <Input
              id="hero-cta"
              onChange={(event) => {
                patchHero({ cta: event.target.value });
              }}
              value={form.hero.cta}
            />
          </div>
          <div className={FIELD}>
            <Label htmlFor="hero-cta-href">CTA 链接</Label>
            <Input
              id="hero-cta-href"
              onChange={(event) => {
                patchHero({ ctaHref: event.target.value });
              }}
              placeholder="https://… 或 /archive"
              value={form.hero.ctaHref}
            />
          </div>
          <div className={`${FIELD} sm:col-span-2`}>
            <Label htmlFor="hero-description">Hero 描述</Label>
            <textarea
              className="border-input bg-background min-h-20 rounded-md border px-3 py-2 text-sm"
              id="hero-description"
              onChange={(event) => {
                patchHero({ description: event.target.value });
              }}
              value={form.hero.description}
            />
          </div>
          <div className={FIELD}>
            <Label htmlFor="hero-meta">脚注</Label>
            <Input
              id="hero-meta"
              onChange={(event) => {
                patchHero({ meta: event.target.value });
              }}
              value={form.hero.meta}
            />
          </div>
        </div>
      </fieldset>

      <FormFailure message={firstFailure([update.error])} />
      {saved ? (
        <output className="text-sm font-medium">站点资料已保存。</output>
      ) : null}
      <FormActions isSaving={update.isPending} submitLabel="保存站点资料" />
    </form>
  );
};
