"use client";

import * as React from "react";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TablePagination from "@mui/material/TablePagination";
import TextField from "@mui/material/TextField";
import { clampPage } from "@/lib/portal/paging";
import { portalCopy } from "@/data/portalCopy";

const PAGE_SIZES = [25, 50, 100];

/**
 * Paging for a filtered list. `resetKey` is anything that changes the result
 * set (the filters): it sends the table back to page one. The page is also
 * clamped to the last real page, because the list can shrink *without* a
 * filter change — flagging a row in a filtered view removes it — and an
 * out-of-range page renders as an empty table.
 */
export function usePagination(total: number, resetKey: string) {
  const [requested, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(PAGE_SIZES[0]);
  React.useEffect(() => {
    setPage(0);
  }, [resetKey, rowsPerPage]);

  const page = clampPage(requested, total, rowsPerPage);
  const slice = <T,>(items: T[]) => items.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
  return { page, rowsPerPage, setPage, setRowsPerPage, slice, total };
}

export type Pagination = ReturnType<typeof usePagination>;

export function TablePager({ pagination }: { pagination: Pagination }) {
  const copy = portalCopy.tableFilters;
  return (
    <TablePagination
      component="div"
      count={pagination.total}
      page={pagination.page}
      onPageChange={(_, next) => pagination.setPage(next)}
      rowsPerPage={pagination.rowsPerPage}
      onRowsPerPageChange={(e) => pagination.setRowsPerPage(Number(e.target.value))}
      rowsPerPageOptions={PAGE_SIZES}
      labelRowsPerPage={copy.rowsPerPage}
      labelDisplayedRows={({ from, to, count }) => copy.displayedRows(from, to, count)}
    />
  );
}

export function FilterSearch({
  value,
  onChange,
  placeholder,
  fullWidth,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Fill the parent (a grid cell) instead of the standalone flex sizing. */
  fullWidth?: boolean;
}) {
  return (
    <TextField
      size="small"
      label={portalCopy.tableFilters.searchLabel}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      fullWidth={fullWidth}
      sx={fullWidth ? undefined : { flex: "1 1 200px", maxWidth: 280, minWidth: 160 }}
    />
  );
}

export function FilterSelect({
  label,
  value,
  onChange,
  options,
  fullWidth,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  fullWidth?: boolean;
}) {
  return (
    <TextField
      select
      size="small"
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      fullWidth={fullWidth}
      sx={{ minWidth: 130 }}
    >
      {options.map((option) => (
        <MenuItem key={option.value} value={option.value}>
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  );
}

/** One wrapping row of filters. */
export function FilterRow({ children }: { children: React.ReactNode }) {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      useFlexGap
      flexWrap="wrap"
      alignItems="center"
      sx={{ mb: 2 }}
    >
      {children}
    </Stack>
  );
}
