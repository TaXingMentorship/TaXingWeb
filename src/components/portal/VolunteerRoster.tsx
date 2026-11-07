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
import { NotesCell } from "./RosterRows";
import { FilterSearch, FilterSelect, TablePager, usePagination } from "./TableFilters";
import { usePortalSession } from "./PortalSessionProvider";
import { useRosterNotes } from "./useRosterNotes";

export default function VolunteerRoster() {
  const { realUser } = usePortalSession();
  const copy = portalCopy.roster;
  const [requestedCohort, setRequestedCohort] = React.useState("");
  const [search, setSearch] = React.useState("");
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
  const { query: notes, save } = useRosterNotes(cohortId);
  const noteById = new Map((notes.data ?? []).map((n) => [n.profile_id, n.notes]));
  const term = search.trim().toLowerCase();
  const filtered = (profiles.data ?? []).filter((p) =>
    [p.full_name, p.email, p.wechat_number, noteById.get(p.id)]
      .some((value) => value?.toLowerCase().includes(term)),
  );
  const pagination = usePagination(filtered.length, JSON.stringify([cohortId, search, realUser?.id]));
  const error = cohorts.error ?? profiles.error ?? notes.error;
  const loading = cohorts.isLoading || (Boolean(cohortId) && (profiles.isLoading || notes.isLoading));

  return (
    <Box>
      <Typography variant="h4" fontWeight={800} gutterBottom>{copy.staffTitle}</Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>{copy.staffHint}</Typography>
      {cohorts.data?.length ? (
        <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
          <FilterSelect label={portalCopy.myMentorship.seasonLabel} value={cohortId}
            onChange={setRequestedCohort}
            options={cohorts.data.map((c) => ({ value: c.id, label: c.name }))} />
          <FilterSearch value={search} onChange={setSearch} placeholder={copy.staffSearch} />
        </Stack>
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
            <Table size="small">
              <TableHead><TableRow>
                {copy.staffColumns.map((label) => <TableCell key={label}>{label}</TableCell>)}
              </TableRow></TableHead>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={5}>{portalCopy.rosterTable.emptyFiltered}</TableCell></TableRow>
                ) : pagination.slice(filtered).map((p) => (
                  <TableRow key={p.id} hover>
                    <TableCell>{p.full_name ?? "—"}</TableCell>
                    <TableCell>{p.email ?? "—"}</TableCell>
                    <TableCell>{p.wechat_number ?? "—"}</TableCell>
                    <TableCell><Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                      {profileLabels(p).map((label) => <Chip key={label} size="small" label={label} variant="outlined" />)}
                    </Stack></TableCell>
                    <TableCell><NotesCell key={`${realUser?.id}:${cohortId}:${p.id}`}
                      value={noteById.get(p.id) ?? null}
                      onSave={async (value) => { await save.mutateAsync({ profileId: p.id, notes: value }); }} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePager pagination={pagination} />
        </Paper>
      )}
    </Box>
  );
}
