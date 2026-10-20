import Link from "next/link";

/**
 * Shown when the API answers FORBIDDEN: the account is signed in but not on `ADMIN_EMAILS`.
 *
 * The message says what to change rather than pretending the page does not exist, because the
 * reader is already authenticated and the deployment is single-user.
 */
export const AdminForbidden = () => (
  <section className="grid gap-3" data-slot="admin-forbidden">
    <h1 className="text-3xl font-semibold tracking-tight">
      403 · 没有写作权限
    </h1>
    <p className="text-muted-foreground text-sm">
      这个账号不在站点的 ADMIN_EMAILS
      白名单里，因此不能进入写作后台。换一个白名单内的账号登录，或让站长把你的地址加进去。
    </p>
    <p className="text-sm">
      <Link className="underline" href="/">
        返回首页
      </Link>
    </p>
  </section>
);
