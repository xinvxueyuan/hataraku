/**
 * Date helpers for the admin forms.
 *
 * A publish date is a calendar day, not an instant: the API takes and returns `YYYY-MM-DD`, and the
 * site displays days in Asia/Shanghai. Formatting through `sv-SE` is the shortest way to get that
 * layout from `Intl` without hand-rolled padding.
 */
const DAY_FORMAT = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Shanghai",
});

/** A stored date as the `value` an `<input type="date">` expects. */
export const toDateInput = (value: Date | null): string =>
  value === null ? "" : DAY_FORMAT.format(value);

/** A date input value as the API takes it; an empty field means "no date". */
export const fromDateInput = (value: string): string | null =>
  value === "" ? null : value;

/** A stored date as the list shows it. */
export const formatDay = (value: Date | null): string =>
  value === null ? "—" : DAY_FORMAT.format(value);
