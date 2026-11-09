"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { portalCopy, profileLabels } from "@/data/portalCopy";
import { listRosterCohorts, listStaffRoster } from "@/lib/portal/store";
import {
  filterEntries,
  groupBy,
  noteSearchText,
  type NoteFilters,
  type RosterEntry,
  type RosterFilters,
} from "@/lib/portal/rosterEntries";
import MentorRecommendCell from "./MentorRecommendCell";
import RosterNoteThread from "./RosterNoteThread";
import StaffFilterSelects from "./RosterStaffFilters";
import {
  emailCellSx,
  identityCellSx,
  nameCellSx,
  notesCellSx,
  recommendCellSx,
  wechatCellSx,
} from "./RosterRows";
import { FilterMultiSelect, FilterSearch, FilterSelect, TablePager, usePagination } from "./TableFilters";
import { usePortalSession } from "./PortalSessionProvider";
import { useMentorRecommendations, useRosterNotes, useRosterStaffAuthors } from "./useRosterNotes";
import { RosterAuthorsProvider } from "./RosterAuthorCard";

export default function VolunteerRoster() {
  const { realUser } = usePortalSession();
  const copy = portalCopy.roster;
  const tableCopy = portalCopy.rosterTable;
  const viewerId = realUser?.id ?? null;
  const [requestedCohort, setRequestedCohort] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [role, setRole] = React.useState<RosterFilters["role"]>([]);
  const [note, setNote] = React.useState<NoteFilters["note"]>("all");
  const [noteAuthor, setNoteAuthor] = React.useState<string[]>([]);
  const [recommend, setRecommend] = React.useState<NoteFilters["recommend"]>("all");

  const cohorts = useQuery({
    queryKey: ["portal", "rosterCohorts", realUser?.id],
    queryFn: listRosterCohorts,
    enabled: Boolean(realUser),
  });
  const cohortId = cohorts.data?.find((c) => c.id === requestedCohort)?.id ?? cohorts.data?.[0]?.id ?? "";
  const profiles = useQuery({
    queryKey: ["portal", "staffRoster", realUser?.id, cohortId],
    queryFn: () => listStaffRoster(cohortId),
    enabled: Boolean(realUser && cohortId),
  });
  const notes = useRosterNotes(cohortId);
  const recs = useMentorRecommendations(cohortId);
  const authors = useRosterStaffAuthors(cohortId);

  const entries = React.useMemo<RosterEntry[]>(() => {
    const notesBy = groupBy(notes.query.data ?? [], (n) => n.profile_id);
    const recsBy = groupBy(recs.query.data ?? [], (r) => r.mentor_id);
    return (profiles.data ?? []).map((p) => {
      const noteEntries = notesBy.get(p.id) ?? [];
      return {
        kind: "member",
        row: {
          profile: p,
          notes: noteSearchText(noteEntries),
          noteEntries,
          recommendations: recsBy.get(p.id) ?? [],
          sessionCount: 0,
          submitted: null,
          gaveGratitude: null,
          completedAll: null,
        },
      };
    });
  }, [profiles.data, notes.query.data, recs.query.data]);

  const filtered = filterEntries(
    entries,
    {
      search,
      role,
      status: [],
      done: "all",
      activity: "all",
      gratitude: "all",
      group: [],
      note,
      noteAuthor,
      recommend,
      viewerId,
      cohortId,
    },
    new Map(),
  );
  const pagination = usePagination(
    filtered.length,
    JSON.stringify([cohortId, search, role, note, noteAuthor, recommend, viewerId]),
  );
  const error = cohorts.error ?? profiles.error ?? notes.query.error ?? recs.query.error;
  const loading =
    cohorts.isLoading ||
    (Boolean(cohortId) && (profiles.isLoading || notes.query.isLoading || recs.query.isLoading));

  return (
    <RosterAuthorsProvider
      authors={authors.data ?? []}
      noteEntries={notes.query.data ?? []}
      recommendations={recs.query.data ?? []}
      cohortId={cohortId}
    >
    <Box>
      <Typography variant="h4" fontWeight={800} gutterBottom>{copy.staffTitle}</Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>{copy.staffHint}</Typography>
      {cohorts.data?.length ? (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
            gap: 1.5,
            mb: 2,
          }}
        >
          <FilterSelect fullWidth label={portalCopy.myMentorship.seasonLabel} value={cohortId}
            onChange={setRequestedCohort}
            options={cohorts.data.map((c) => ({ value: c.id, label: c.name }))} />
          <Box sx={{ gridColumn: { xs: "1 / -1", sm: "span 2" } }}>
            <FilterSearch fullWidth value={search} onChange={setSearch} placeholder={copy.staffSearch} />
          </Box>
          <FilterMultiSelect fullWidth label={tableCopy.roleLabel} value={role}
            onChange={(v) => setRole(v as RosterFilters["role"])}
            options={Object.entries(tableCopy.roleOptions).map(([value, label]) => ({ value, label }))} />
          <StaffFilterSelects
            entries={notes.query.data ?? []}
            viewerId={viewerId}
            note={note}
            onNote={setNote}
            noteAuthor={noteAuthor}
            onNoteAuthor={setNoteAuthor}
            recommend={recommend}
            onRecommend={setRecommend}
          />
          <Stack justifyContent="center" sx={{ minHeight: 40 }}>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-line" }}>
              {tableCopy.total(filtered.length, entries.length)}
            </Typography>
          </Stack>
        </Box>
      ) : null}
      {error ? (
        <Alert severity="error">{error.message}</Alert>
      ) : loading ? (
        <Alert severity="info">{copy.staffLoading}</Alert>
      ) : !cohortId ? (
        <Alert severity="info">{copy.staffNoCohorts}</Alert>
      ) : (
        <Paper>
          <TableContainer>
            <Table size="small" sx={{ "& thead th": { whiteSpace: "nowrap" } }}>
              <TableHead><TableRow>
                {copy.staffColumns.map((label, i) => (
                  <TableCell key={label}
                    sx={[nameCellSx, emailCellSx, wechatCellSx, identityCellSx, recommendCellSx][i] ?? (i === copy.staffColumns.length - 1 ? notesCellSx : undefined)}>
                    {label}
                  </TableCell>
                ))}
              </TableRow></TableHead>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={copy.staffColumns.length}>{tableCopy.emptyFiltered}</TableCell></TableRow>
                ) : pagination.slice(filtered).map((entry) => {
                  if (entry.kind !== "member") return null;
                  const { profile: p, noteEntries, recommendations } = entry.row;
                  return (
                    <TableRow key={`${viewerId}:${cohortId}:${p.id}`} hover sx={{ verticalAlign: "top" }}>
                      <TableCell sx={nameCellSx}>{p.full_name ?? "—"}</TableCell>
                      <TableCell sx={emailCellSx}>{p.email ?? "—"}</TableCell>
                      <TableCell sx={wechatCellSx}>{p.wechat_number ?? "—"}</TableCell>
                      <TableCell sx={identityCellSx}><Stack direction="row" spacing={0.5} useFlexGap flexWrap="nowrap">
                        {profileLabels(p).map((label) => <Chip key={label} size="small" label={label} variant="outlined" />)}
                      </Stack></TableCell>
                      <TableCell sx={recommendCellSx}>
                        {p.participant_role === "mentor" ? (
                          <MentorRecommendCell
                            mentorName={p.full_name ?? ""}
                            cohortId={cohortId}
                            viewerId={viewerId}
                            recommendations={recommendations ?? []}
                            onSet={async (reason) => { await recs.set.mutateAsync({ mentorId: p.id, reason }); }}
                            onRemove={async () => { await recs.remove.mutateAsync(p.id); }}
                          />
                        ) : "—"}
                      </TableCell>
                      <TableCell sx={notesCellSx}>
                        <RosterNoteThread
                          entries={noteEntries ?? []}
                          viewerId={viewerId}
                          isAdmin={false}
                          onAdd={async (body) => { await notes.add.mutateAsync({ profileId: p.id, body }); }}
                          onEdit={async (entryId, body) => { await notes.edit.mutateAsync({ entryId, body }); }}
                          onDelete={async (entryId) => { await notes.remove.mutateAsync(entryId); }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePager pagination={pagination} />
        </Paper>
      )}
    </Box>
    </RosterAuthorsProvider>
  );
}
