/**
 * The password-reset mail, and one transport that can send it.
 *
 * Resend's REST API is called with `fetch`: the SDK would be a second dependency for a single POST.
 * The `From` address and the API key are deployment configuration and arrive as options, so no
 * address is written down here. The reset URL comes from Better Auth, built on the configured
 * `BETTER_AUTH_URL`, which is why the link a reader receives points at the deployment instead of a
 * domain this file would have to guess.
 */

export interface EmailMessage {
  from: string;
  html: string;
  subject: string;
  text: string;
  to: string;
}

/** The transport seam: production posts to Resend, tests capture the message. */
export type EmailSender = (message: EmailMessage) => Promise<void>;

const RESEND_ENDPOINT = "https://api.resend.com/emails";

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const greeting = (name: string): string =>
  name.trim() === "" ? "你好：" : `你好，${name}：`;

/**
 * The message a reader receives. Both bodies say the same thing: someone asked to reset this
 * address, the link is valid for an hour, and ignoring the mail leaves the password unchanged.
 */
export const passwordResetMail = ({
  name,
  url,
}: {
  name: string;
  url: string;
}): Pick<EmailMessage, "html" | "subject" | "text"> => {
  const subject = "重置登录密码";

  const text = [
    greeting(name),
    "",
    "有人请求重置这个邮箱在本站的登录密码。如果这是你本人，请在 1 小时内打开下面的链接设置新密码：",
    "",
    url,
    "",
    "如果不是你本人，请忽略这封邮件，你的密码不会改变。",
    "",
  ].join("\n");

  const html = [
    `<p>${escapeHtml(greeting(name))}</p>`,
    "<p>有人请求重置这个邮箱在本站的登录密码。如果这是你本人，请在 1 小时内打开下面的链接设置新密码：</p>",
    `<p><a href="${escapeHtml(url)}">设置新密码</a></p>`,
    "<p>如果不是你本人，请忽略这封邮件，你的密码不会改变。</p>",
  ].join("");

  return { html, subject, text };
};

/**
 * Posts one message to Resend.
 *
 * A refused message is thrown, never swallowed: the caller logs it, and a deployment whose key is
 * wrong finds out from its logs instead of from silence. (Better Auth runs the callback inside
 * `runInBackgroundOrAwait`, which catches the error and still answers 200, so the log is the place a
 * failure surfaces — the reset endpoint must not become an account-existence oracle.)
 */
export const resendSender =
  (apiKey: string): EmailSender =>
  async (message) => {
    const response = await fetch(RESEND_ENDPOINT, {
      body: JSON.stringify(message),
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      const detail = await response.text();

      throw new Error(
        `Resend refused the password reset email (${response.status} ${response.statusText}): ${detail.slice(0, 200)}`
      );
    }
  };
