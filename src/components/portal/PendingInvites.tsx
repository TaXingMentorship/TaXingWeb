"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import Link from "@mui/material/Link";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import type { Cohort } from "@/types/portal";
import { listCohorts, listRosterInvites } from "@/lib/portal/store";
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

  const pending = React.useMemo(
    () => (invites ?? []).filter((invite) => !invite.claimed_user_id),
    [invites],
  );

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
                </TableRow>
              </TableHead>
              <TableBody>
                {pending.map((invite) => (
                  <TableRow key={invite.id} hover>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
}
