"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import type { RosterNoteEntry } from "@/types/portal";
import { portalCopy } from "@/data/portalCopy";
import { RosterAuthorName } from "./RosterAuthorCard";

const COLLAPSED = 2;

export function noteAuthorLabel(entry: Pick<RosterNoteEntry, "author_id" | "author_name">) {
  const copy = portalCopy.roster;
  if (!entry.author_id) return copy.noteLegacyAuthor;
  return entry.author_name?.trim() || copy.noteUnknownAuthor;
}

/** 2026-11-21 → 26/11/21, in the viewer's time zone. */
export function shortDate(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getFullYear() % 100)}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

/** ⌘/Ctrl+Enter submits; plain Enter adds a line, and IME composition is left alone. */
const isSubmitKey = (e: React.KeyboardEvent) =>
  e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing;

/**
 * A member's internal notes as a thread. Each entry reads as one compact
 * line — the text, then 「— 作者 · 26/11/21」 — so the column stays short.
 * Authors edit or delete their own entries; admins may also delete any.
 */
export default function RosterNoteThread({
  memberName,
  entries,
  viewerId,
  isAdmin,
  onAdd,
  onEdit,
  onDelete,
}: {
  memberName: string;
  entries: RosterNoteEntry[];
  viewerId: string | null;
  isAdmin: boolean;
  onAdd: (body: string) => Promise<void>;
  onEdit: (entryId: string, body: string) => Promise<void>;
  onDelete: (entryId: string) => Promise<void>;
}) {
  const copy = portalCopy.roster;
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);

  const shown = expanded ? entries : entries.slice(-COLLAPSED);
  const hidden = entries.length - shown.length;

  const run = async (action: () => Promise<void>, message: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      return true;
    } catch {
      setError(message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    const body = text.trim();
    if (!body || busy) return;
    if (await run(() => onAdd(body), copy.noteSaveError)) {
      setText("");
      setAdding(false);
    }
  };

  return (
    <Stack spacing={0.5} sx={{ minWidth: 260 }}>
      {(hidden > 0 || (expanded && entries.length > COLLAPSED)) && (
        <Button
          size="small"
          onClick={() => setExpanded((v) => !v)}
          sx={{ alignSelf: "flex-start", minWidth: 0, p: 0 }}
        >
          {expanded ? copy.noteCollapse : copy.noteShowAll(entries.length)}
        </Button>
      )}
      {shown.map((entry) => {
        const mine = entry.author_id !== null && entry.author_id === viewerId;
        return editingId === entry.id ? (
          <EditEntry
            key={entry.id}
            initial={entry.body}
            busy={busy}
            onCancel={() => setEditingId(null)}
            onSave={async (body) => {
              if (body === entry.body) return setEditingId(null);
              if (await run(() => onEdit(entry.id, body), copy.noteSaveError)) setEditingId(null);
            }}
          />
        ) : (
          <NoteLine
            key={entry.id}
            entry={entry}
            busy={busy}
            onEdit={mine ? () => setEditingId(entry.id) : undefined}
            onDelete={
              mine || isAdmin
                ? () => {
                    // A hard delete with no undo, so always ask first.
                    if (!window.confirm(copy.noteDeleteConfirm(mine ? null : noteAuthorLabel(entry)))) {
                      return;
                    }
                    void run(() => onDelete(entry.id), copy.noteDeleteError);
                  }
                : undefined
            }
          />
        );
      })}
      {error && !adding && (
        <Typography variant="caption" color="error">{error}</Typography>
      )}
      <Button
        size="small"
        disabled={busy}
        onClick={() => {
          setError(null);
          setAdding(true);
        }}
        sx={{ alignSelf: "flex-start", whiteSpace: "nowrap" }}
      >
        {copy.notePlaceholder}
      </Button>
      <Dialog open={adding} onClose={() => { if (!busy) setAdding(false); }} maxWidth="sm" fullWidth>
        <DialogTitle>{copy.noteAddFor(memberName)}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label={copy.notePlaceholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (isSubmitKey(e)) {
                e.preventDefault();
                void submit();
              }
            }}
            disabled={busy}
            error={Boolean(error)}
            helperText={error ?? (busy ? copy.noteSaving : undefined)}
            multiline
            minRows={4}
            fullWidth
            sx={{ mt: 1 }}
            slotProps={{ htmlInput: { maxLength: 2000 } }}
          />
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setAdding(false)}>
            {copy.noteEditCancel}
          </Button>
          <Button variant="contained" disabled={busy || !text.trim()} onClick={submit}>
            {copy.noteAdd}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

/** One entry on one line: text, then 「— 作者 · 26/11/21」 and the actions. */
function NoteLine({
  entry,
  busy,
  onEdit,
  onDelete,
}: {
  entry: RosterNoteEntry;
  busy: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const copy = portalCopy.roster;
  const iconSx = { p: 0.25, ml: 0.25, verticalAlign: "text-bottom" } as const;
  return (
    <Typography
      variant="body2"
      component="div"
      sx={{
        wordBreak: "break-word",
        whiteSpace: "pre-wrap",
        // Actions appear on hover / keyboard focus; touch screens always show them.
        "& .note-actions": { opacity: 0, transition: "opacity .15s" },
        "&:hover .note-actions, &:focus-within .note-actions": { opacity: 1 },
        "@media (hover: none)": { "& .note-actions": { opacity: 1 } },
      }}
    >
      {entry.body}
      <Typography
        variant="caption"
        component="span"
        color="text.secondary"
        sx={{ ml: 0.75, whiteSpace: "nowrap" }}
      >
        {"— "}
        <RosterAuthorName id={entry.author_id} fallback={noteAuthorLabel(entry)} />
        {" · "}
        {shortDate(entry.created_at)}
        {entry.edited_at && (
          <span title={copy.noteEditedAt(shortDate(entry.edited_at))}>
            {" · "}
            {copy.noteEdited}
          </span>
        )}
      </Typography>
      {(onEdit || onDelete) && (
        <Box component="span" className="note-actions" sx={{ whiteSpace: "nowrap" }}>
          {onEdit && (
            <IconButton
              size="small"
              aria-label={copy.noteEdit}
              title={copy.noteEdit}
              disabled={busy}
              onClick={onEdit}
              sx={iconSx}
            >
              <EditOutlinedIcon sx={{ fontSize: 14 }} />
            </IconButton>
          )}
          {onDelete && (
            <IconButton
              size="small"
              aria-label={copy.noteDelete}
              title={copy.noteDelete}
              disabled={busy}
              onClick={onDelete}
              sx={iconSx}
            >
              <CloseIcon sx={{ fontSize: 14 }} />
            </IconButton>
          )}
        </Box>
      )}
    </Typography>
  );
}

function EditEntry({
  initial,
  busy,
  onSave,
  onCancel,
}: {
  initial: string;
  busy: boolean;
  onSave: (body: string) => void;
  onCancel: () => void;
}) {
  const copy = portalCopy.roster;
  const [value, setValue] = React.useState(initial);
  const save = () => {
    const body = value.trim();
    if (body) onSave(body);
  };
  return (
    <Stack spacing={0.25}>
      <TextField
        variant="standard"
        size="small"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (isSubmitKey(e)) {
            e.preventDefault();
            save();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        disabled={busy}
        autoFocus
        multiline
        fullWidth
        slotProps={{ htmlInput: { maxLength: 2000 } }}
      />
      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
        <Button size="small" disabled={busy} onClick={onCancel} sx={{ minWidth: 0 }}>
          {copy.noteEditCancel}
        </Button>
        <Button
          size="small"
          variant="contained"
          disableElevation
          disabled={busy || !value.trim()}
          onClick={save}
          sx={{ minWidth: 0 }}
        >
          {copy.noteEditSave}
        </Button>
      </Stack>
    </Stack>
  );
}
