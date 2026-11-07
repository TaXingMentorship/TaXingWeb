"use client";

import * as React from "react";
import Checkbox from "@mui/material/Checkbox";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { RosterNoteEntry } from "@/types/portal";
import { portalCopy } from "@/data/portalCopy";
import { LEGACY_AUTHOR, noteAuthors, type NoteFilters } from "@/lib/portal/rosterEntries";
import MemberAvatar from "./MemberAvatar";
import { noteAuthorLabel } from "./RosterNoteThread";
import { useRosterAuthor } from "./RosterAuthorCard";
import { FilterSelect } from "./TableFilters";

const CLEAR = "__clear";

/** 备注 / 备注人 / 推荐 filters, shared by the admin and volunteer rosters. */
export default function StaffFilterSelects({
  entries,
  viewerId,
  note,
  onNote,
  noteAuthor,
  onNoteAuthor,
  recommend,
  onRecommend,
  fullWidth = true,
}: {
  /** Every note entry of the season, to list who has written notes. */
  entries: RosterNoteEntry[];
  viewerId: string | null;
  note: NoteFilters["note"];
  onNote: (value: NoteFilters["note"]) => void;
  noteAuthor: string[];
  onNoteAuthor: (value: string[]) => void;
  recommend: NoteFilters["recommend"];
  onRecommend: (value: NoteFilters["recommend"]) => void;
  fullWidth?: boolean;
}) {
  const copy = portalCopy.roster;
  const toOptions = (labels: Record<string, string>) =>
    Object.entries(labels).map(([value, label]) => ({ value, label }));

  return (
    <>
      <FilterSelect
        fullWidth={fullWidth}
        label={copy.noteFilterLabel}
        value={note}
        onChange={(v) => onNote(v as NoteFilters["note"])}
        options={toOptions(copy.noteFilterOptions)}
      />
      <NoteAuthorSelect
        entries={entries}
        viewerId={viewerId}
        value={noteAuthor}
        onChange={onNoteAuthor}
        fullWidth={fullWidth}
      />
      <FilterSelect
        fullWidth={fullWidth}
        label={copy.recommendFilterLabel}
        value={recommend}
        onChange={(v) => onRecommend(v as NoteFilters["recommend"])}
        options={toOptions(copy.recommendFilterOptions)}
      />
    </>
  );
}

/**
 * 备注人, multi-select. Options are the people who actually wrote notes this
 * season (the viewer first, then by how many they wrote), each with avatar and
 * count. Nothing selected means everyone.
 */
function NoteAuthorSelect({
  entries,
  viewerId,
  value,
  onChange,
  fullWidth,
}: {
  entries: RosterNoteEntry[];
  viewerId: string | null;
  value: string[];
  onChange: (value: string[]) => void;
  fullWidth: boolean;
}) {
  const copy = portalCopy.roster;
  const authors = React.useMemo(() => {
    const list = noteAuthors(entries).map((a) => ({
      ...a,
      label: noteAuthorLabel({
        author_id: a.id === LEGACY_AUTHOR ? null : a.id,
        author_name: a.name,
      }),
    }));
    // The viewer first; the rest keep their most-notes-first order.
    return [...list.filter((a) => a.id === viewerId), ...list.filter((a) => a.id !== viewerId)];
  }, [entries, viewerId]);
  const labelOf = new Map(authors.map((a) => [a.id, a.label]));
  // Drop selections that no longer exist (season change, entry deleted). The
  // parent's state is pruned too: it is what filters the table, so a stale id
  // left there would hide every row while this select shows 全部.
  const selected = value.filter((id) => labelOf.has(id));
  const stale = selected.length !== value.length;
  React.useEffect(() => {
    if (stale) onChange(selected);
  }, [stale, selected, onChange]);

  return (
    <TextField
      select
      size="small"
      label={copy.noteAuthorLabel}
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
          renderValue: (ids) => {
            const list = ids as string[];
            if (list.length === 0) return copy.noteAuthorAll;
            return copy.noteAuthorSelected(
              list.map((id) => (id === viewerId ? copy.noteAuthorMine : (labelOf.get(id) ?? ""))),
            );
          },
          MenuProps: { slotProps: { paper: { sx: { maxHeight: 360 } } } },
        },
        inputLabel: { shrink: true },
      }}
    >
      {authors.length === 0 && (
        <MenuItem disabled>
          <Typography variant="body2" color="text.secondary">
            {copy.noteAuthorEmpty}
          </Typography>
        </MenuItem>
      )}
      {authors.map((a) => (
        <MenuItem key={a.id} value={a.id} dense>
          <Checkbox size="small" checked={selected.includes(a.id)} sx={{ p: 0.5, mr: 0.5 }} />
          <ListItemIcon sx={{ minWidth: 32 }}>
            <AuthorAvatar id={a.id} />
          </ListItemIcon>
          <ListItemText
            primary={a.id === viewerId ? copy.noteAuthorMe(a.label) : a.label}
            secondary={copy.noteAuthorCount(a.count)}
            slotProps={{ secondary: { variant: "caption" } }}
          />
        </MenuItem>
      ))}
      {selected.length > 0 && (
        <MenuItem value={CLEAR} dense sx={{ borderTop: 1, borderColor: "divider" }}>
          <Typography variant="body2" color="primary">
            {copy.noteAuthorClear}
          </Typography>
        </MenuItem>
      )}
    </TextField>
  );
}

function AuthorAvatar({ id }: { id: string }) {
  const author = useRosterAuthor(id === LEGACY_AUTHOR ? null : id);
  return (
    <MemberAvatar src={author?.avatar_url ?? undefined} sx={{ width: 24, height: 24, fontSize: 12 }}>
      {(author?.full_name ?? "·").slice(0, 1)}
    </MemberAvatar>
  );
}
