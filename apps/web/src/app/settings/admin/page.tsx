import Link from "next/link";

import { Card } from "@hataraku/ui/components/card";

import { AdminForbidden } from "#src/components/admin-forbidden.tsx";
import { AdminPageShell } from "#src/components/admin-page-shell.tsx";
import { isForbidden, requireSession } from "#src/server/admin.ts";
import { serverCall } from "#src/server/query.ts";

const PATH = "/settings/admin";

/**
 * The writing desk: every admin surface, one line about what it is for, and the counts that matter
 * while writing (how much is still a draft).
 *
 * The counts come from the same procedures the lists use, so an entry can never disagree with the
 * page it opens. The login allowlist has no `/settings/admin` entry yet, so the redirect value stays
 * on the posts list — the closest page the login page will return to.
 */
const AdminIndexPage = async () => {
  await requireSession("/settings/admin/posts");

  let forbidden = false;

  let counts: {
    changelog: number;
    drafts: number;
    micro: number;
    posts: number;
    projects: number;
  } | null = null;

  try {
    const [postStats, micro, projects, changelog] = await Promise.all([
      serverCall.posts.adminStats(),
      serverCall.content.micro.adminList({ pageSize: 1 }),
      serverCall.content.projects.adminList({ pageSize: 1 }),
      serverCall.content.changelog.adminList({ pageSize: 1 }),
    ]);

    counts = {
      changelog: changelog.total,
      drafts: postStats.drafts,
      micro: micro.total,
      posts: postStats.total,
      projects: projects.total,
    };
  } catch (error) {
    if (isForbidden(error)) {
      forbidden = true;
    } else {
      throw error;
    }
  }

  if (forbidden || counts === null) {
    return <AdminForbidden />;
  }

  const spaces = [
    {
      count: `${counts.posts} 篇 · 草稿 ${counts.drafts}`,
      description: "长文，正文是 MDX；保存、发布与分类标签都在这里。",
      href: "/settings/admin/posts",
      label: "文章",
    },
    {
      count: `${counts.micro} 条`,
      description: "短句与碎片，纯文本，前台在 /micro。",
      href: "/settings/admin/micro",
      label: "微言",
    },
    {
      count: `${counts.projects} 个`,
      description: "项目与实验，含状态、排序和封面。",
      href: "/settings/admin/projects",
      label: "项目",
    },
    {
      count: `${counts.changelog} 条`,
      description: "版本记录，发版时记一条。",
      href: "/settings/admin/changelog",
      label: "更新日志",
    },
    {
      count: "站点资料",
      description: "站点名称、简介与作者信息，影响页脚和元数据。",
      href: "/settings/admin/profile",
      label: "站点",
    },
    {
      count: "账号",
      description: "登录会话与两步验证状态。",
      href: "/settings/security",
      label: "安全",
    },
    {
      count: "账号",
      description: "修改登录密码。",
      href: "/settings/password",
      label: "密码",
    },
    {
      count: "账号",
      description: "两步验证的设置与恢复码。",
      href: "/settings/two-factor",
      label: "两步验证",
    },
  ] as const;

  return (
    <AdminPageShell
      current={PATH}
      description="写作与账号的全部入口；数量与你打开的那一页始终一致。"
      title="写作后台"
    >
      <ul className="grid gap-4 sm:grid-cols-2" data-slot="admin-index">
        {spaces.map((space) => (
          <li key={space.href}>
            <Card>
              <Link
                className="grid gap-1 px-4 py-4 hover:underline"
                href={space.href}
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-lg font-medium">{space.label}</span>
                  <span className="text-muted-foreground text-xs">
                    {space.count}
                  </span>
                </span>
                <span className="text-muted-foreground text-sm">
                  {space.description}
                </span>
              </Link>
            </Card>
          </li>
        ))}
      </ul>
    </AdminPageShell>
  );
};

export default AdminIndexPage;
