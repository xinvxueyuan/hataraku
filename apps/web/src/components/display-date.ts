/**
 * One date format for the content pages, in the site's time zone.
 *
 * Date columns arrive in two shapes: a `Date` from timestamp columns and a `YYYY-MM-DD` string from
 * date columns. A date column has no clock, so it is anchored at midnight in Asia/Shanghai rather
 * than UTC — otherwise a reader one day behind would see the wrong day. An unparseable string is
 * shown as written instead of being hidden.
 */
const formatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "long",
  timeZone: "Asia/Shanghai",
});

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/u;

export const formatDisplayDate = (
  value: Date | string | null | undefined
): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : formatter.format(value);
  }

  const parsed = new Date(
    DATE_ONLY.test(value) ? `${value}T00:00:00+08:00` : value
  );

  return Number.isNaN(parsed.getTime()) ? value : formatter.format(parsed);
};
