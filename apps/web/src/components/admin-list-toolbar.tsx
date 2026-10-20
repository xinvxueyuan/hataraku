import { Pager } from "#src/components/pager.tsx";

export interface AdminListFilterField {
  label: string;
  name: string;
  options: readonly { label: string; value: string }[];
}

const controlClass =
  "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border px-3 text-sm outline-none focus-visible:ring-3";

/**
 * The search box, the filter selects and the pager, as one plain GET form.
 *
 * A GET form needs no client JavaScript: submitting it produces exactly the query string the page
 * already knows how to read, so the filtered view is a real URL that can be bookmarked and pasted.
 * The pager below keeps that same query string while it changes the page.
 */
export const AdminListToolbar = ({
  actions,
  fields,
  hrefFor,
  label,
  page,
  path,
  query,
  selected,
  total,
  totalPages,
}: {
  actions?: React.ReactNode;
  fields: readonly AdminListFilterField[];
  hrefFor: (page: number) => string;
  label: string;
  page: number;
  path: string;
  query: string | undefined;
  selected: Readonly<Record<string, string | undefined>>;
  total: number;
  totalPages: number;
}) => (
  <div className="grid gap-4">
    <form
      action={path}
      className="flex flex-wrap items-end gap-3"
      data-slot="admin-list-toolbar"
      method="get"
    >
      <div className="grid gap-1">
        <label className="text-muted-foreground text-xs" htmlFor="admin-search">
          搜索
        </label>
        <input
          className={`${controlClass} min-w-56`}
          defaultValue={query ?? ""}
          id="admin-search"
          name="q"
          placeholder="标题、slug 或正文"
          type="search"
        />
      </div>

      {fields.map((field) => (
        <div className="grid gap-1" key={field.name}>
          <label
            className="text-muted-foreground text-xs"
            htmlFor={`admin-${field.name}`}
          >
            {field.label}
          </label>
          <select
            className={controlClass}
            defaultValue={selected[field.name] ?? ""}
            id={`admin-${field.name}`}
            name={field.name}
          >
            <option value="">全部</option>
            {field.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ))}

      <button
        className="bg-primary text-primary-foreground h-9 rounded-md px-4 text-sm font-medium"
        type="submit"
      >
        筛选
      </button>

      <a
        className="text-muted-foreground hover:text-foreground h-9 self-center text-sm hover:underline"
        href={path}
      >
        重置
      </a>

      <p className="text-muted-foreground ml-auto self-center text-sm">
        共 {total} 条
      </p>

      {actions === undefined ? null : (
        <div className="self-center">{actions}</div>
      )}
    </form>

    <Pager
      currentPage={page}
      hrefFor={hrefFor}
      label={label}
      totalPages={totalPages}
    />
  </div>
);
