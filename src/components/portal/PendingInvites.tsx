"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import TablePagination from "@mui/material/TablePagination";
import Chip from "@mui/material/Chip";
import Link from "@mui/material/Link";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import type { Cohort } from "@/types/portal";
import { listCohorts, listRosterInvites, setInviteNotParticipating } from "@/lib/portal/store";
import { portalCopy, profileLabels } from "@/data/portalCopy";

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

  const { data: invites, isLoading } = useQuery({
    queryKey: ["portal", "rosterInvites", "all"],
    queryFn: () => listRosterInvites(),
  });
  const { data: cohorts } = useQuery({
    queryKey: ["portal", "cohorts"],
    queryFn: listCohorts,
  });

  const cohortName = React.useMemo(
    () => new Map((cohorts ?? []).map((c: Cohort) => [c.id, c.name])),
    [cohorts],
  );

  // People who will not take part sink to the bottom: the top of the list is
  // whoever can still be chased.
  const pending = React.useMemo(
    () =>
      (invites ?? [])
        .filter((invite) => !invite.claimed_user_id)
        .sort((a, b) => Number(a.not_participating) - Number(b.not_participating)),
    [invites],
  );
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [seasonFilter, setSeasonFilter] = React.useState("all");
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(25);
  React.useEffect(() => {
    setPage(0);
  }, [search, statusFilter, seasonFilter, rowsPerPage]);

  const visible = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return pending.filter((invite) => {
      if (q && !`${invite.full_name ?? ""} ${invite.email}`.toLowerCase().includes(q)) return false;
      if (statusFilter === "waiting" && invite.not_participating) return false;
      if (statusFilter === "out" && !invite.not_participating) return false;
      if (seasonFilter !== "all" && invite.cohort_id !== seasonFilter) return false;
      return true;
    });
  }, [pending, search, statusFilter, seasonFilter]);
  const pagedInvites = visible.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  const outCount = pending.filter((invite) => invite.not_participating).length;

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

      {isLoading ? (
        <Typography color="text.secondary">{portalCopy.volunteers.loading}</Typography>
      ) : pending.length === 0 ? (
        <Alert severity="success">{copy.empty}</Alert>
      ) : (
        <>
        <Alert severity="info" sx={{ mb: 2 }}>
          {copy.summary(outCount, pending.length - outCount)}
        </Alert>
        <Stack
          direction="row"
          spacing={1.5}
          useFlexGap
          flexWrap="wrap"
          alignItems="center"
          sx={{ mb: 2 }}
        >
          <TextField
            size="small"
            label="搜索"
            placeholder="姓名 / 邮箱"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ flex: "1 1 200px", maxWidth: 280, minWidth: 160 }}
          />
          <TextField
            select
            size="small"
            label="状态"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            sx={{ minWidth: 130 }}
          >
            <MenuItem value="all">全部</MenuItem>
            <MenuItem value="waiting">{copy.stillExpected}</MenuItem>
            <MenuItem value="out">{copy.notParticipating}</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            label={copy.columns.season}
            value={seasonFilter}
            onChange={(e) => setSeasonFilter(e.target.value)}
            sx={{ minWidth: 130 }}
          >
            <MenuItem value="all">全部季度</MenuItem>
            {(cohorts ?? []).map((c: Cohort) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}
          </TextField>
          <Typography variant="body2" color="text.secondary">
            共 {visible.length} 条
            {visible.length !== pending.length ? `（筛选自 ${pending.length} 条）` : ""}
          </Typography>
        </Stack>
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
                {pagedInvites.map((invite) => (
                  <TableRow
                    key={invite.id}
                    hover
                    sx={
                      invite.not_participating
                        ? { bgcolor: "action.selected", color: "text.secondary" }
                        : undefined
                    }
                  >
                    <TableCell sx={{ minWidth: 100, wordBreak: "break-word" }}>
                      {invite.full_name ?? "—"}
                    </TableCell>
                    <TableCell sx={{ minWidth: 180 }}>
                      <Link
                        href={`mailto:${invite.email}`}
                        variant="body2"
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
                        {invite.not_participating ? (
                          <Chip size="small" color="default" label={copy.notParticipating} />
                        ) : (
                          <Chip size="small" variant="outlined" label={copy.stillExpected} />
                        )}
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
          <TablePagination
            component="div"
            count={visible.length}
            page={page}
            onPageChange={(_, next) => setPage(next)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => setRowsPerPage(Number(e.target.value))}
            rowsPerPageOptions={[25, 50, 100]}
            labelRowsPerPage="每页"
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`}
          />
        </Paper>
        </>
      )}
    </Box>
  );
}
