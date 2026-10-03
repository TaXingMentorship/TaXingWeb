"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import AddIcon from "@mui/icons-material/Add";
import Tooltip from "@mui/material/Tooltip";
import type { BulletinBoard, Cohort, Profile } from "@/types/portal";
import {
  listBoards,
  listCohorts,
  listProfiles,
  listVolunteers,
  setCohortBulletinOpen,
} from "@/lib/portal/store";
import { portalCopy } from "@/data/portalCopy";
import { usePortalSession } from "@/components/portal/PortalSessionProvider";
import CohortDialog from "@/components/portal/CohortDialog";

export default function CohortsPage() {
  const copy = portalCopy.cohorts;
  const { currentUser } = usePortalSession();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Cohort | null>(null);

  const isAdmin = currentUser?.is_admin ?? false;

  const { data: cohorts, isLoading } = useQuery({
    queryKey: ["portal", "cohorts"],
    queryFn: listCohorts,
    enabled: isAdmin,
  });
  const { data: profiles } = useQuery({
    queryKey: ["portal", "profiles"],
    queryFn: () => listProfiles(),
    enabled: isAdmin,
  });
  const { data: boards } = useQuery({
    queryKey: ["portal", "boards", "all"],
    queryFn: () => listBoards(),
    enabled: isAdmin,
  });
  const { data: volunteers } = useQuery({
    queryKey: ["portal", "volunteers"],
    queryFn: listVolunteers,
    enabled: isAdmin,
  });

  // Counted client-side from lists an admin can already read, the same way
  // countPostsByBoard does it — no extra queries.
  //
  // One person is one key, so the columns can overlap (a mentor who also
  // volunteers is in both) but the total never double-counts. A volunteer is
  // keyed by their account when they have one, so the roster row and the
  // profile are the same person.
  const counts = React.useMemo(() => {
    type Row = {
      mentor: number;
      mentee: number;
      volunteer: Set<string>;
      uncategorised: number;
      total: Set<string>;
    };
    const byCohort: Record<string, Row> = {};
    const row = (id: string): Row =>
      (byCohort[id] ??= {
        mentor: 0,
        mentee: 0,
        volunteer: new Set(),
        uncategorised: 0,
        total: new Set(),
      });

    // Volunteers on the roster for a season, with or without an account.
    const rostered = new Map<string, Set<string>>();
    for (const volunteer of volunteers ?? []) {
      const key = volunteer.profile_id ?? `v:${volunteer.id}`;
      for (const season of volunteer.seasons) {
        row(season.cohort_id).volunteer.add(key);
        row(season.cohort_id).total.add(key);
        const keys = rostered.get(season.cohort_id) ?? new Set<string>();
        keys.add(key);
        rostered.set(season.cohort_id, keys);
      }
    }

    for (const profile of (profiles ?? []) as Profile[]) {
      for (const id of profile.cohort_ids) {
        const r = row(id);
        r.total.add(profile.id);
        if (profile.participant_role === "mentor") r.mentor += 1;
        if (profile.participant_role === "mentee") r.mentee += 1;
        if (profile.is_volunteer) r.volunteer.add(profile.id);
        if (
          !profile.participant_role &&
          !profile.is_volunteer &&
          !rostered.get(id)?.has(profile.id)
        ) {
          r.uncategorised += 1;
        }
      }
    }
    return byCohort;
  }, [profiles, volunteers]);

  const boardCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const board of (boards ?? []) as BulletinBoard[]) {
      counts[board.cohort_id] = (counts[board.cohort_id] ?? 0) + 1;
    }
    return counts;
  }, [boards]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["portal", "cohorts"] });

  const toggleMutation = useMutation({
    mutationFn: (input: { id: string; open: boolean }) =>
      setCohortBulletinOpen(input.id, input.open),
    onSuccess: invalidate,
  });

  if (!isAdmin) {
    return <Alert severity="error">{copy.adminOnly}</Alert>;
  }

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (cohort: Cohort) => {
    setEditing(cohort);
    setDialogOpen(true);
  };

  const formatRange = (cohort: Cohort) => {
    if (!cohort.starts_at && !cohort.ends_at) return null;
    return `${cohort.starts_at ?? copy.unset} ~ ${cohort.ends_at ?? copy.unset}`;
  };

  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        gap={1}
        sx={{ mb: 1 }}
      >
        <Typography variant="h4" fontWeight={800}>
          {copy.title}
        </Typography>
        <Button
          variant="contained"
          color="secondary"
          startIcon={<AddIcon />}
          onClick={openCreate}
        >
          {copy.createButton}
        </Button>
      </Stack>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {copy.subtitle}
      </Typography>

      {toggleMutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {(toggleMutation.error as Error).message}
        </Alert>
      )}

      {isLoading ? (
        <Typography color="text.secondary">{copy.loading}</Typography>
      ) : !cohorts || cohorts.length === 0 ? (
        <Alert severity="info">{copy.empty}</Alert>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{copy.nameLabel}</TableCell>
                <TableCell>{`${copy.startsAtLabel} / ${copy.endsAtLabel}`}</TableCell>
                <TableCell align="right">
                  <Tooltip title={copy.mentorCountHint}>
                    <span>{copy.mentorCount}</span>
                  </Tooltip>
                </TableCell>
                <TableCell align="right">
                  <Tooltip title={copy.menteeCountHint}>
                    <span>{copy.menteeCount}</span>
                  </Tooltip>
                </TableCell>
                <TableCell align="right">
                  <Tooltip title={copy.volunteerCountHint}>
                    <span>{copy.volunteerCount}</span>
                  </Tooltip>
                </TableCell>
                <TableCell align="right">
                  <Tooltip title={copy.totalCountHint}>
                    <span>{copy.totalCount}</span>
                  </Tooltip>
                </TableCell>
                <TableCell align="right">
                  <Tooltip title={copy.uncategorisedCountHint}>
                    <span>{copy.uncategorisedCount}</span>
                  </Tooltip>
                </TableCell>
                <TableCell align="right">{copy.boardCount}</TableCell>
                <TableCell align="center">{copy.bulletinOpenLabel}</TableCell>
                <TableCell align="right">{copy.actions}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cohorts.map((cohort) => {
                const range = formatRange(cohort);
                return (
                  <TableRow key={cohort.id} hover>
                    <TableCell>
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        flexWrap="wrap"
                        useFlexGap
                      >
                        <Typography fontWeight={700}>{cohort.name}</Typography>
                        {!cohort.bulletin_open && (
                          <Chip size="small" label={copy.archived} />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      {range ? (
                        <Typography variant="body2">{range}</Typography>
                      ) : (
                        // Cohorts without a start date sort last, so make the
                        // gap visible rather than silent.
                        <Typography variant="body2" color="text.secondary">
                          {copy.unset}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {counts[cohort.id]?.mentor ?? 0}
                    </TableCell>
                    <TableCell align="right">
                      {counts[cohort.id]?.mentee ?? 0}
                    </TableCell>
                    <TableCell align="right">
                      {counts[cohort.id]?.volunteer.size ?? 0}
                    </TableCell>
                    <TableCell align="right">
                      {counts[cohort.id]?.total.size ?? 0}
                    </TableCell>
                    <TableCell align="right">
                      {counts[cohort.id]?.uncategorised ?? 0}
                    </TableCell>
                    <TableCell align="right">
                      {boardCounts[cohort.id] ?? 0}
                    </TableCell>
                    <TableCell align="center">
                      <Switch
                        size="small"
                        checked={cohort.bulletin_open}
                        onChange={(e) =>
                          toggleMutation.mutate({
                            id: cohort.id,
                            open: e.target.checked,
                          })
                        }
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => openEdit(cohort)}>
                        {copy.edit}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: "block" }}>
        {copy.noDeleteHint}
      </Typography>

      <CohortDialog
        open={dialogOpen}
        cohort={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={() => {
          setDialogOpen(false);
          invalidate();
        }}
      />
    </Box>
  );
}
