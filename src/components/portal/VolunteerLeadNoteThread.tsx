"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import type { VolunteerLeadNote } from "@/types/portal";
import { portalCopy } from "@/data/portalCopy";
import { shortDate } from "./RosterNoteThread";

const COLLAPSED = 2;

const isSubmitKey = (e: React.KeyboardEvent) =>
  e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing;

/**
 * Lead-only notes about one volunteer. Deliberately unlike the roster's note
 * thread: an amber, locked box that says who can read it, so nobody mistakes it
 * for an ordinary note. Authors edit/delete their own; admins may delete any.
 */
export default function VolunteerLeadNoteThread({
  volunteerName,
  notes,
  viewerId,
  isAdmin,
  blacklisted,
  onAdd,
  onEdit,
  onDelete,
}: {
  volunteerName: string;
  notes: VolunteerLeadNote[];
  viewerId: string | null;
  isAdmin: boolean;
  blacklisted?: boolean;
  onAdd: (body: string) => Promise<void>;
  onEdit: (noteId: string, body: string) => Promise<void>;
  onDelete: (noteId: string) => Promise<void>;
}) {
  const copy = portalCopy.volunteers.leadNotes;
  const [expanded, setExpanded] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const shown = expanded ? notes : notes.slice(-COLLAPSED);
  const hidden = notes.length - shown.length;

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
    if (await run(() => onAdd(body), copy.saveError)) {
      setText("");
      setAdding(false);
    }
  };

  return (
    <Box
      sx={(theme) => ({
        minWidth: 240,
        p: 1,
        borderRadius: 1.5,
        borderLeft: "3px solid",
        borderColor: "warning.main",
        bgcolor: alpha(theme.palette.warning.main, 0.1),
      })}
    >
      <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 0.5 }}>
        <LockOutlinedIcon sx={{ fontSize: 14, color: "warning.dark" }} aria-hidden />
        <Typography variant="caption" fontWeight={700} sx={{ color: "warning.dark" }} title={copy.hint}>
          {copy.badge}
        </Typography>
        {blacklisted && <Chip size="small" color="error" label={copy.blacklisted} sx={{ height: 18 }} />}
      </Stack>
      <Stack spacing={0.5}>
        {(hidden > 0 || (expanded && notes.length > COLLAPSED)) && (
          <Button
            size="small"
            onClick={() => setExpanded((v) => !v)}
            sx={{ alignSelf: "flex-start", minWidth: 0, p: 0 }}
          >
            {expanded ? copy.collapse : copy.showAll(notes.length)}
          </Button>
        )}
        {shown.map((note) => {
          const mine = note.author_id !== null && note.author_id === viewerId;
          return editingId === note.id ? (
            <EditNote
              key={note.id}
              initial={note.body}
              busy={busy}
              onCancel={() => setEditingId(null)}
              onSave={async (body) => {
                if (body === note.body) return setEditingId(null);
                if (await run(() => onEdit(note.id, body), copy.saveError)) setEditingId(null);
              }}
            />
          ) : (
            <Typography
              key={note.id}
              variant="body2"
              component="div"
              sx={{
                wordBreak: "break-word",
                whiteSpace: "pre-wrap",
                "& .note-actions": { opacity: 0, transition: "opacity .15s" },
                "&:hover .note-actions, &:focus-within .note-actions": { opacity: 1 },
                "@media (hover: none)": { "& .note-actions": { opacity: 1 } },
              }}
            >
              {note.body}
              <Typography
                variant="caption"
                component="span"
                color="text.secondary"
                sx={{ ml: 0.75, whiteSpace: "nowrap" }}
              >
                {"— "}
                {note.author_name?.trim() || copy.unknownAuthor}
                {" · "}
                {shortDate(note.created_at)}
                {note.edited_at && ` · ${copy.edited}`}
              </Typography>
              {(mine || isAdmin) && (
                <Box component="span" className="note-actions" sx={{ whiteSpace: "nowrap" }}>
                  {mine && (
                    <IconButton
                      size="small"
                      aria-label={copy.edit}
                      title={copy.edit}
                      disabled={busy}
                      onClick={() => setEditingId(note.id)}
                      sx={{ p: 0.25, ml: 0.25, verticalAlign: "text-bottom" }}
                    >
                      <EditOutlinedIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  )}
                  <IconButton
                    size="small"
                    aria-label={copy.delete}
                    title={copy.delete}
                    disabled={busy}
                    onClick={() => {
                      const who = mine ? null : note.author_name?.trim() || copy.unknownAuthor;
                      if (!window.confirm(copy.deleteConfirm(who))) return;
                      void run(() => onDelete(note.id), copy.deleteError);
                    }}
                    sx={{ p: 0.25, ml: 0.25, verticalAlign: "text-bottom" }}
                  >
                    <CloseIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Box>
              )}
            </Typography>
          );
        })}
        {error && !adding && (
          <Typography variant="caption" color="error">
            {error}
          </Typography>
        )}
        <Button
          size="small"
          color="warning"
          disabled={busy}
          onClick={() => {
            setError(null);
            setAdding(true);
          }}
          sx={{ alignSelf: "flex-start", whiteSpace: "nowrap" }}
        >
          {copy.add}
        </Button>
      </Stack>
      <Dialog open={adding} onClose={() => { if (!busy) setAdding(false); }} maxWidth="sm" fullWidth>
        <DialogTitle>{copy.addFor(volunteerName)}</DialogTitle>
        <DialogContent>
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 1 }}>
            <LockOutlinedIcon sx={{ fontSize: 16, color: "warning.dark" }} aria-hidden />
            <Typography variant="body2" sx={{ color: "warning.dark" }}>
              {copy.badge}。{copy.hint}
            </Typography>
          </Stack>
          <TextField
            autoFocus
            label={copy.placeholder}
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
            helperText={error ?? (busy ? copy.saving : undefined)}
            multiline
            minRows={4}
            fullWidth
            slotProps={{ htmlInput: { maxLength: 2000 } }}
          />
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setAdding(false)}>
            {copy.cancel}
          </Button>
          <Button variant="contained" color="warning" disabled={busy || !text.trim()} onClick={submit}>
            {copy.save}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function EditNote({
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
  const copy = portalCopy.volunteers.leadNotes;
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
          {copy.cancel}
        </Button>
        <Button
          size="small"
          variant="contained"
          color="warning"
          disableElevation
          disabled={busy || !value.trim()}
          onClick={save}
          sx={{ minWidth: 0 }}
        >
          {copy.save}
        </Button>
      </Stack>
    </Stack>
  );
}
