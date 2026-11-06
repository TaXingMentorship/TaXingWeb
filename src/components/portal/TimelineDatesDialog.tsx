"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import type { ActivityItem } from "@/types/portal";
import { resetTimelineDates, saveTimelineDates } from "@/lib/portal/store";
import { portalCopy } from "@/data/portalCopy";
import {
  defaultTimelineRow,
  formatRange,
  programDay,
  type TimelineRow,
} from "@/data/activityTimeline";

/**
 * Admin-only: change one timeline row's dates and week label for the season
 * (0041). The 子活动 under the row stay where they are — they hang by key, not
 * by date — so the dialog counts sessions the new range would leave outside.
 */
export default function TimelineDatesDialog({
  open,
  row,
  overridden,
  items,
  cohortId,
  updatedBy,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** The row with any current override applied. */
  row: TimelineRow;
  /** Whether the row has an override now, i.e. 恢复默认 does something. */
  overridden: boolean;
  /** This row's 子活动. */
  items: ActivityItem[];
  cohortId: string;
  updatedBy: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const copy = portalCopy.activities.datesDialog;
  const defaults = defaultTimelineRow(row.key);

  const [from, setFrom] = React.useState(row.from);
  const [to, setTo] = React.useState(row.to);
  const [week, setWeek] = React.useState(row.week);
  const [validationError, setValidationError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setFrom(row.from);
    setTo(row.to);
    setWeek(row.week);
    setValidationError(null);
  }, [open, row.from, row.to, row.week]);

  const outside =
    from && to
      ? items.filter((i) => {
          if (i.kind !== "session" || !i.starts_at) return false;
          const day = programDay(new Date(i.starts_at));
          return day < from || day > to;
        }).length
      : 0;

  const saveMutation = useMutation({
    mutationFn: () =>
      saveTimelineDates({
        cohort_id: cohortId,
        row_key: row.key,
        from_day: from,
        to_day: to,
        week_label: week.trim(),
        updated_by: updatedBy,
      }),
    onSuccess: onSaved,
  });
  const resetMutation = useMutation({
    mutationFn: () => resetTimelineDates(cohortId, row.key),
    onSuccess: onSaved,
  });

  const { reset: resetSave } = saveMutation;
  const { reset: resetReset } = resetMutation;
  React.useEffect(() => {
    if (!open) return;
    resetSave();
    resetReset();
  }, [open, resetSave, resetReset]);

  const submit = () => {
    if (!from || !to || !week.trim()) return setValidationError(copy.required);
    if (to < from) return setValidationError(copy.rangeInvalid);
    setValidationError(null);
    saveMutation.mutate();
  };

  const mutationError = saveMutation.error ?? resetMutation.error;
  const busy = saveMutation.isPending || resetMutation.isPending;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{copy.title(row.title)}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {validationError && <Alert severity="error">{validationError}</Alert>}
          {mutationError && <Alert severity="error">{(mutationError as Error).message}</Alert>}
          {outside > 0 && <Alert severity="warning">{copy.outside(outside)}</Alert>}
          <Stack direction="row" spacing={1.5}>
            <TextField
              label={copy.fromLabel}
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            <TextField
              label={copy.toLabel}
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
          </Stack>
          <TextField
            label={copy.weekLabel}
            placeholder={copy.weekPlaceholder}
            value={week}
            onChange={(e) => setWeek(e.target.value)}
            helperText={copy.helper}
            fullWidth
          />
          {defaults && (
            <Typography variant="body2" color="text.secondary">
              {copy.defaults(formatRange(defaults.from, defaults.to), defaults.week)}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        {overridden && (
          <Button
            color="inherit"
            disabled={busy}
            onClick={() => resetMutation.mutate()}
            sx={{ mr: "auto" }}
          >
            {copy.reset}
          </Button>
        )}
        <Button onClick={onClose}>{copy.cancel}</Button>
        <Button variant="contained" color="secondary" disabled={busy} onClick={submit}>
          {copy.save}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
