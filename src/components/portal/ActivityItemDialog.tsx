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
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import type { ActivityItem, ActivityItemKind } from "@/types/portal";
import {
  createActivityItem,
  deleteActivityItem,
  updateActivityItem,
  type ActivityItemInput,
} from "@/lib/portal/store";
import { portalCopy } from "@/data/portalCopy";
import {
  formatRange,
  placeSession,
  programDay,
  seriesRows,
  type TimelineRow,
} from "@/data/activityTimeline";

/** http(s) with a host and no spaces — a bare `http://` is not a link. */
const HTTP_URL = /^https?:\/\/[^\s/]+\S*$/i;

/** ISO timestamp → the `YYYY-MM-DDTHH:mm` a datetime-local input wants, in local time. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const KINDS: ActivityItemKind[] = ["session", "link"];

/**
 * Shared by create and edit — `item` null means create, from the timeline row
 * `parent`. Links carry a url, sessions a time (activity_items_shape, 0038).
 * A link stays under `parent`; a session goes to the row of `parent`'s series
 * that covers its program date (`placeSession`, in PROGRAM_TIME_ZONE), so an
 * 11/24 圆桌 added from the Week 4 row lands under Week 5–7, and a date no row
 * covers is refused.
 */
export default function ActivityItemDialog({
  open,
  item,
  parent,
  cohortId,
  createdBy,
  onClose,
  onSaved,
}: {
  open: boolean;
  item: ActivityItem | null;
  parent: TimelineRow;
  cohortId: string;
  createdBy: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const copy = portalCopy.activities.itemDialog;

  const [kind, setKind] = React.useState<ActivityItemKind>("session");
  const [title, setTitle] = React.useState("");
  const [startsAt, setStartsAt] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [meetingUrl, setMeetingUrl] = React.useState("");
  const [recordingUrl, setRecordingUrl] = React.useState("");
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const [deleteArmed, setDeleteArmed] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setKind(item?.kind ?? parent.defaultKind);
    setTitle(item?.title ?? "");
    setStartsAt(toLocalInput(item?.starts_at ?? null));
    setSummary(item?.summary ?? "");
    setUrl(item?.url ?? "");
    setMeetingUrl(item?.meeting_url ?? "");
    setRecordingUrl(item?.recording_url ?? "");
    setValidationError(null);
    setDeleteArmed(false);
  }, [open, item, parent.defaultKind]);

  const session = kind === "session";
  const series = seriesRows(parent);
  // The datetime-local value is the editor's local time; the row is decided by
  // that moment's program date, so who re-saves it never changes where it sits.
  const target =
    session && startsAt ? placeSession(parent, programDay(new Date(startsAt))) : null;
  const outOfRange = session && Boolean(startsAt) && !target;
  const startsAtHelper = outOfRange
    ? copy.outOfRange(series.map((r) => formatRange(r.from, r.to)).join("、"))
    : target && target.key !== parent.key
      ? copy.placedIn(`${target.title} · ${target.week}（${formatRange(target.from, target.to)}）`)
      : copy.startsAtHelper;

  const saveMutation = useMutation({
    mutationFn: () => {
      const blank = (v: string) => v.trim() || null;
      // Only the fields of the chosen shape are kept, so switching type in the
      // dialog never leaves a hidden value behind.
      const payload: ActivityItemInput = {
        parent_key: session ? target!.key : (item?.parent_key ?? parent.key),
        kind,
        title: title.trim(),
        starts_at: session ? new Date(startsAt).toISOString() : null,
        summary: blank(summary),
        url: session ? null : blank(url),
        meeting_url: session ? blank(meetingUrl) : null,
        recording_url: session ? blank(recordingUrl) : null,
      };
      return item
        ? updateActivityItem(item.id, payload)
        : createActivityItem({ ...payload, cohort_id: cohortId, created_by: createdBy });
    },
    onSuccess: onSaved,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteActivityItem(item!.id),
    onSuccess: onSaved,
  });

  const submit = () => {
    if (!title.trim()) return setValidationError(copy.titleRequired);
    if (session && !startsAt) return setValidationError(copy.startsAtRequired);
    if (outOfRange) return setValidationError(startsAtHelper);
    if (!session && !url.trim()) return setValidationError(copy.urlRequired);
    const links = session ? [meetingUrl, recordingUrl] : [url];
    if (links.some((l) => l.trim() && !HTTP_URL.test(l.trim()))) {
      return setValidationError(copy.urlInvalid);
    }
    setValidationError(null);
    saveMutation.mutate();
  };

  // The page keeps this dialog mounted between uses: a failure from the last
  // time must not greet the next one.
  const { reset: resetSave } = saveMutation;
  const { reset: resetDelete } = deleteMutation;
  React.useEffect(() => {
    if (!open) return;
    resetSave();
    resetDelete();
  }, [open, resetSave, resetDelete]);

  const mutationError = saveMutation.error ?? deleteMutation.error;
  const busy = saveMutation.isPending || deleteMutation.isPending;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {item ? copy.editTitle(parent.title) : copy.createTitle(parent.title)}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {validationError && <Alert severity="error">{validationError}</Alert>}
          {mutationError && <Alert severity="error">{(mutationError as Error).message}</Alert>}
          {deleteArmed && <Alert severity="warning">{copy.deleteConfirm}</Alert>}

          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
              {copy.kindLabel}
            </Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              color="secondary"
              value={kind}
              onChange={(_, v: ActivityItemKind | null) => v && setKind(v)}
              sx={{ flexWrap: "wrap" }}
            >
              {KINDS.map((k) => (
                <ToggleButton key={k} value={k} sx={{ textTransform: "none" }}>
                  {copy.kinds[k]}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          {session ? (
            <>
              <TextField
                label={copy.startsAtLabel}
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                helperText={startsAtHelper}
                error={outOfRange}
                slotProps={{ inputLabel: { shrink: true } }}
                fullWidth
              />
              <TextField
                label={copy.sessionTitleLabel}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                fullWidth
              />
              <TextField
                label={copy.summaryLabel}
                placeholder={copy.summaryPlaceholder}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                multiline
                minRows={2}
                fullWidth
              />
              <TextField
                label={copy.meetingUrlLabel}
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
                fullWidth
              />
              <TextField
                label={copy.recordingUrlLabel}
                value={recordingUrl}
                onChange={(e) => setRecordingUrl(e.target.value)}
                fullWidth
              />
            </>
          ) : (
            <>
              <TextField
                label={copy.linkTitleLabel}
                placeholder={copy.linkTitlePlaceholder}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                fullWidth
              />
              <TextField
                label={copy.urlLabel}
                placeholder={copy.urlPlaceholder}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                fullWidth
              />
              <TextField
                label={copy.linkSummaryLabel}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                fullWidth
              />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        {item && (
          <Button
            color="error"
            disabled={busy}
            onClick={() => (deleteArmed ? deleteMutation.mutate() : setDeleteArmed(true))}
            sx={{ mr: "auto" }}
          >
            {copy.delete}
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
