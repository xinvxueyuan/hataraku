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
import type { AnalyticsSettings } from "#src/components/site-analytics-settings.ts";
import { api } from "#src/lib/api.ts";

/** The providers the form offers, with the label each one gets. */
const ANALYTICS_PROVIDERS = [
  { label: "关闭（不统计）", value: "none" },
  { label: "Umami", value: "umami" },
  { label: "Plausible", value: "plausible" },
  { label: "Google Analytics", value: "google" },
  { label: "自建脚本", value: "custom" },
] as const;

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
  analytics: AnalyticsSettings;
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
  analytics: AnalyticsSettings;
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

/** Off by default, and the DNT switch starts on: the reader's preference is the safer default. */
const initialAnalytics = (): AnalyticsSettings => ({
  enabled: false,
  provider: "none",
  respectDnt: true,
  scriptSrc: "",
  siteId: "",
});

const initialForm = (profile: EditableSiteProfile | null): ProfileForm => {
  if (profile === null) {
    return {
      analytics: initialAnalytics(),
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
    analytics: profile.analytics,
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

  const patchAnalytics = (changes: Partial<AnalyticsSettings>) => {
    setSaved(false);
    setForm((previous) => ({
      ...previous,
      analytics: { ...previous.analytics, ...changes },
    }));
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

      <fieldset className="grid gap-4 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">站点统计</legend>

        <p className="text-muted-foreground text-sm">
          默认关闭。启用后，被选中的第三方统计服务会收到访问数据（页面地址、来源、
          设备与时区等），本站既不代理也不过滤这些数据；停用后不再加载脚本。
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className={FIELD}>
            <Label htmlFor="analytics-provider">服务</Label>
            <select
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              id="analytics-provider"
              onChange={(event) => {
                const provider = ANALYTICS_PROVIDERS.find(
                  (option) => option.value === event.target.value
                );

                if (provider !== undefined) {
                  patchAnalytics({ provider: provider.value });
                }
              }}
              value={form.analytics.provider}
            >
              {ANALYTICS_PROVIDERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className={FIELD}>
            <Label htmlFor="analytics-site-id">站点 ID</Label>
            <Input
              id="analytics-site-id"
              onChange={(event) => {
                patchAnalytics({ siteId: event.target.value });
              }}
              placeholder="服务商给的那串标识"
              value={form.analytics.siteId}
            />
          </div>

          <div className={`${FIELD} sm:col-span-2`}>
            <Label htmlFor="analytics-script-src">脚本地址（可选）</Label>
            <Input
              id="analytics-script-src"
              onChange={(event) => {
                patchAnalytics({ scriptSrc: event.target.value });
              }}
              placeholder="https://…（自建服务时填，留空用官方地址）"
              value={form.analytics.scriptSrc}
            />
            <p className="text-muted-foreground text-xs">
              只接受 https；「自建脚本」必须填这一项。
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-6">
          <label
            className="flex items-center gap-2 text-sm"
            htmlFor="analytics-enabled"
          >
            <input
              checked={form.analytics.enabled}
              className="size-4"
              id="analytics-enabled"
              onChange={(event) => {
                patchAnalytics({ enabled: event.target.checked });
              }}
              type="checkbox"
            />
            启用统计
          </label>

          <label
            className="flex items-center gap-2 text-sm"
            htmlFor="analytics-dnt"
          >
            <input
              checked={form.analytics.respectDnt}
              className="size-4"
              id="analytics-dnt"
              onChange={(event) => {
                patchAnalytics({ respectDnt: event.target.checked });
              }}
              type="checkbox"
            />
            尊重 Do Not Track
          </label>
        </div>

        <p className="text-muted-foreground text-xs">
          勾选「尊重 Do Not Track」时，浏览器声明了 DNT 的访客不会加载脚本；
          统计只在正式构建里注入，开发与测试环境不会向第三方发送任何数据。
        </p>
      </fieldset>

      <FormFailure message={firstFailure([update.error])} />
      {saved ? (
        <output className="text-sm font-medium">站点资料已保存。</output>
      ) : null}
      <FormActions isSaving={update.isPending} submitLabel="保存站点资料" />
    </form>
  );
};
