/**
 * The page to actually show. A list can shrink without any filter changing
 * (flagging a row inside a filtered view removes it), which would leave the
 * requested page past the end and the table empty.
 */
export function clampPage(requested: number, total: number, rowsPerPage: number): number {
  const lastPage = Math.max(0, Math.ceil(total / rowsPerPage) - 1);
  return Math.min(Math.max(0, requested), lastPage);
}
