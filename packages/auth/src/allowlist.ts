/**
 * The access allowlist behind `ADMIN_EMAILS`, the variable the previous stack used to
 * decide who may reach the private side of the site.
 *
 * An unset or empty value means "no allowlist": the app is open to any visitor, which is
 * what a public todo app needs. Setting it turns the deployment single-user.
 */
export const parseAdminEmails = (raw?: string): string[] =>
  (raw ?? "")
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 0);

/** `undefined` when no allowlist is configured; otherwise a membership test. */
export const createEmailAllowlist = (
  raw?: string
): ((email: string) => boolean) | undefined => {
  const allowed = parseAdminEmails(raw);

  if (allowed.length === 0) {
    return undefined;
  }

  const entries = new Set(allowed);

  return (email) => entries.has(email.trim().toLowerCase());
};
