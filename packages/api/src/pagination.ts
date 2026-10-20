/** Builds the page envelope every list procedure returns. */
export const paginate = <T>(
  items: T[],
  total: number,
  input: { page: number; pageSize: number }
) => ({
  items,
  page: input.page,
  pageSize: input.pageSize,
  total,
  totalPages: total === 0 ? 0 : Math.ceil(total / input.pageSize),
});
