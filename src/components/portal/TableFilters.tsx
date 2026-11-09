"use client";

import * as React from "react";
import Checkbox from "@mui/material/Checkbox";
import ListItemText from "@mui/material/ListItemText";
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

const CLEAR = "__clear";

/**
 * A filter that takes several values. Nothing selected means everything (the
 * 全部 state), so callers treat an empty array as "no filter".
 */
export function FilterMultiSelect({
  label,
  value,
  onChange,
  options,
  fullWidth,
}: {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  options: { value: string; label: string }[];
  fullWidth?: boolean;
}) {
  const copy = portalCopy.tableFilters;
  const labelOf = new Map(options.map((o) => [o.value, o.label]));
  // A value that is no longer an option (season change) is not shown, and is
  // pruned from the parent so it cannot silently hide rows.
  const selected = value.filter((v) => labelOf.has(v));
  const stale = selected.length !== value.length;
  React.useEffect(() => {
    if (stale) onChange(selected);
  }, [stale, selected, onChange]);

  return (
    <TextField
      select
      size="small"
      label={label}
      fullWidth={fullWidth}
      sx={{ minWidth: 130 }}
      value={selected}
      onChange={(e) => {
        const next = e.target.value as unknown as string[];
        onChange(next.includes(CLEAR) ? [] : next);
      }}
      slotProps={{
        select: {
          multiple: true,
          displayEmpty: true,
          renderValue: (v) => {
            const list = v as string[];
            return list.length === 0
              ? copy.all
              : copy.multiSelected(list.map((id) => labelOf.get(id) ?? ""));
          },
          MenuProps: { slotProps: { paper: { sx: { maxHeight: 360 } } } },
        },
        inputLabel: { shrink: true },
      }}
    >
      {/* 全部 = no filter, so it is checked exactly when nothing else is. */}
      <MenuItem value={CLEAR} dense sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Checkbox size="small" checked={selected.length === 0} sx={{ p: 0.5, mr: 0.5 }} />
        <ListItemText primary={copy.all} />
      </MenuItem>
      {options.map((option) => (
        <MenuItem key={option.value} value={option.value} dense>
          <Checkbox size="small" checked={selected.includes(option.value)} sx={{ p: 0.5, mr: 0.5 }} />
          <ListItemText primary={option.label} />
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
