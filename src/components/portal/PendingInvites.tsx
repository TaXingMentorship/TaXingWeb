"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Link from "@mui/material/Link";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import type { Cohort } from "@/types/portal";
import {
  listCohorts,
  listProfiles,
  listRosterInvites,
  setInviteNotParticipating,
} from "@/lib/portal/store";
import { pendingInvites, type ClassifiedInvite } from "@/lib/portal/rosterEntries";
import { portalCopy, profileLabels } from "@/data/portalCopy";
import { dimmedRowSx, InviteStateChip } from "@/components/portal/RosterRows";
import {
  FilterRow,
  FilterSearch,
  FilterSelect,
  TablePager,
  usePagination,
} from "@/components/portal/TableFilters";

/**
 * People who were invited but have not signed in yet.
 *
 * Until someone completes onboarding, `claim_roster_invite` has not run, so
 * they have no `profiles` row — and every member-facing page reads `profiles`.
 * They were therefore invisible everywhere: an admin could import thirty people
 * and have no way to see which of them actually arrived, short of querying the
 * database.
 *
 * Shown across all seasons rather than scoped to the one selected above. "Who
 * still has not come" is a question about people, not about a season, and with
 * eleven seasons the answer would otherwise take eleven clicks to assemble.
 */
export default function PendingInvites() {
  const copy = portalCopy.pendingInvites;
  const queryClient = useQueryClient();

  const invitesQuery = useQuery({
    queryKey: ["portal", "rosterInvites", "all"],
    queryFn: () => listRosterInvites(),
  });
  const profilesQuery = useQuery({
    queryKey: ["portal", "profiles"],
    queryFn: () => listProfiles(),
  });
  const invites = invitesQuery.data;
  const profiles = profilesQuery.data;
  const { data: cohorts } = useQuery({
    queryKey: ["portal", "cohorts"],
    queryFn: listCohorts,
  });

  const cohortName = React.useMemo(
    () => new Map((cohorts ?? []).map((c: Cohort) => [c.id, c.name])),
    [cohorts],
  );

  // Classified against the accounts that exist, so this list and the roster
  // table agree about the same person. Empty until profiles have loaded: before
  // that, someone who already has an account would flash up as "waiting".
  // Ordered so the top is whoever can still be chased and flagged-out people
  // sink to the bottom.
  const pending = React.useMemo<ClassifiedInvite[]>(
    () => pendingInvites(invites ?? [], profiles),
    [invites, profiles],
  );

  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [seasonFilter, setSeasonFilter] = React.useState("all");
  const visible = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return pending.filter(({ invite, state }) => {
      if (q && !`${invite.full_name ?? ""} ${invite.email}`.toLowerCase().includes(q)) return false;
      if (statusFilter !== "all" && state !== statusFilter) return false;
      if (seasonFilter !== "all" && invite.cohort_id !== seasonFilter) return false;
      return true;
    });
  }, [pending, search, statusFilter, seasonFilter]);
  const pagination = usePagination(visible.length, [search, statusFilter, seasonFilter].join("|"));

  const countOf = (state: ClassifiedInvite["state"]) =>
    pending.filter((item) => item.state === state).length;

  const markMutation = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) =>
      setInviteNotParticipating(id, value),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["portal", "rosterInvites"] }),
  });

  return (
    <Box component="section">
      <Typography variant="h5" fontWeight={800} gutterBottom>
        {copy.title}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {copy.intro}
      </Typography>

      {invitesQuery.isError || profilesQuery.isError ? (
        // Both are needed to tell who is pending; with either missing, say so
        // rather than sit on "loading" forever or claim nobody is waiting.
        <Alert severity="error">{copy.loadFailed}</Alert>
      ) : invitesQuery.isLoading || !profiles ? (
        <Typography color="text.secondary">{portalCopy.volunteers.loading}</Typography>
      ) : pending.length === 0 ? (
        <Alert severity="success">{copy.empty}</Alert>
      ) : (
        <>
          <Alert severity="info" sx={{ mb: 2 }}>
            {copy.summary(
              countOf("out"),
              countOf("waiting"),
              countOf("account"),
            )}
          </Alert>
          {markMutation.isError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => markMutation.reset()}>
              {copy.markFailed}
            </Alert>
          )}
          <FilterRow>
            <FilterSearch
              value={search}
              onChange={setSearch}
              placeholder={copy.searchPlaceholder}
            />
            <FilterSelect
              label={copy.statusLabel}
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: portalCopy.tableFilters.all },
                { value: "waiting", label: copy.stillExpected },
                { value: "account", label: copy.accountOnly },
                { value: "out", label: copy.notParticipating },
              ]}
            />
            <FilterSelect
              label={copy.columns.season}
              value={seasonFilter}
              onChange={setSeasonFilter}
              options={[
                { value: "all", label: copy.allSeasons },
                ...(cohorts ?? []).map((c: Cohort) => ({ value: c.id, label: c.name })),
              ]}
            />
            <Typography variant="body2" color="text.secondary">
              {copy.total(visible.length, pending.length)}
            </Typography>
          </FilterRow>
          <Paper sx={{ borderRadius: 3, overflow: "hidden" }}>
            <TableContainer sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{copy.columns.name}</TableCell>
                    <TableCell>{copy.columns.email}</TableCell>
                    <TableCell>{copy.columns.identity}</TableCell>
                    <TableCell>{copy.columns.season}</TableCell>
                    <TableCell>{copy.columns.invitedAt}</TableCell>
                    <TableCell>{copy.columns.status}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pagination.slice(visible).map(({ invite, state }) => (
                    <TableRow
                      key={invite.id}
                      hover
                      sx={state === "out" ? dimmedRowSx : undefined}
                    >
                      <TableCell sx={{ minWidth: 100, wordBreak: "break-word" }}>
                        {invite.full_name ?? "—"}
                      </TableCell>
                      <TableCell sx={{ minWidth: 180 }}>
                        <Link
                          href={`mailto:${invite.email}`}
                          variant="body2"
                          color="inherit"
                          sx={{ wordBreak: "break-all" }}
                        >
                          {invite.email}
                        </Link>
                      </TableCell>
                      <TableCell sx={{ minWidth: 100 }}>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                          {profileLabels(invite).map((label) => (
                            <Chip key={label} size="small" variant="outlined" label={label} />
                          ))}
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ minWidth: 90 }}>
                        {cohortName.get(invite.cohort_id) ?? "—"}
                      </TableCell>
                      <TableCell
                        sx={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}
                      >
                        {new Date(invite.invited_at).toLocaleDateString("zh-CN")}
                      </TableCell>
                      <TableCell sx={{ minWidth: 190, whiteSpace: "nowrap" }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <InviteStateChip state={state} />
                          <Button
                            size="small"
                            disabled={markMutation.isPending}
                            onClick={() =>
                              markMutation.mutate({
                                id: invite.id,
                                value: !invite.not_participating,
                              })
                            }
                          >
                            {invite.not_participating ? copy.unmark : copy.mark}
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePager pagination={pagination} />
          </Paper>
        </>
      )}
    </Box>
  );
}
