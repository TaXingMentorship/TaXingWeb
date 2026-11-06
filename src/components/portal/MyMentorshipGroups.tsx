"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { portalCopy } from "@/data/portalCopy";
import { visibleToMember } from "@/lib/portal/directoryFilters";
import { listCohorts, listMyMentorshipMatches, listProfiles } from "@/lib/portal/store";
import type { Profile } from "@/types/portal";
import DirectoryCard from "./DirectoryCard";
import ProfileDialog from "./ProfileDialog";
import { usePortalSession } from "./PortalSessionProvider";

export default function MyMentorshipGroups() {
  const { realUser, currentUser } = usePortalSession();
  const copy = portalCopy.myMentorship;
  const [requestedSeason, setRequestedSeason] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const cohortsQuery = useQuery({
    queryKey: ["portal", "myMentorshipCohorts", realUser?.id, realUser?.cohort_ids],
    queryFn: listCohorts,
    enabled: Boolean(realUser),
  });
  const seasons = (cohortsQuery.data ?? []).filter((c) => realUser?.cohort_ids.includes(c.id));
  const cohortId = seasons.find((c) => c.id === requestedSeason)?.id ?? seasons[0]?.id ?? "";
  const groupsQuery = useQuery({
    queryKey: ["portal", "myMentorship", realUser?.id, cohortId, realUser?.cohort_ids],
    queryFn: async () => {
      const matches = await listMyMentorshipMatches(cohortId, realUser!.id);
      const ids = Array.from(new Set(matches.flatMap((m) => [m.mentor_id, m.mentee_id])));
      const profiles = await listProfiles({ ids });
      return { matches, profiles };
    },
    enabled: Boolean(realUser && cohortId),
  });
  React.useEffect(() => {
    setRequestedSeason("");
    setSelectedId(null);
  }, [realUser?.id]);
  React.useEffect(() => setSelectedId(null), [cohortId, currentUser?.is_admin]);

  const profiles = new Map(
    (groupsQuery.data?.profiles ?? [])
      .filter((p) => currentUser?.is_admin || visibleToMember(p, realUser?.cohort_ids ?? []))
      .map((p) => [p.id, p]),
  );
  const groups = new Map<string, Set<string>>();
  for (const match of groupsQuery.data?.matches ?? []) {
    const mentees = groups.get(match.mentor_id) ?? new Set<string>();
    mentees.add(match.mentee_id);
    groups.set(match.mentor_id, mentees);
  }
  const error = cohortsQuery.error ?? groupsQuery.error;
  const loading = cohortsQuery.isLoading || (Boolean(cohortId) && groupsQuery.isLoading);
  const selected = !error && !loading && selectedId ? profiles.get(selectedId) ?? null : null;
  const member = (id: string) => {
    const profile: Profile | undefined = profiles.get(id);
    return (
      <Grid key={id} size={{ xs: 12, sm: 6, md: 4 }}>
        {id === realUser?.id && <Chip size="small" label={copy.you} sx={{ mb: 1 }} />}
        {profile ? (
          <DirectoryCard profile={profile} onSelect={(p) => setSelectedId(p.id)} />
        ) : (
          <Alert severity="info">{copy.unavailable}</Alert>
        )}
      </Grid>
    );
  };

  if (!realUser) return null;
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h6" fontWeight={800}>{copy.title}</Typography>
          <Typography color="text.secondary">{copy.intro}</Typography>
        </Box>
        {seasons.length > 0 && (
          <TextField select size="small" label={copy.seasonLabel} value={cohortId}
            onChange={(e) => setRequestedSeason(e.target.value)} sx={{ minWidth: 200 }}>
            {seasons.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
          </TextField>
        )}
      </Stack>
      {error ? (
        <Alert severity="error" action={<Button color="inherit" onClick={() => {
          void cohortsQuery.refetch();
          if (cohortId) void groupsQuery.refetch();
        }}>{copy.retry}</Button>}>{copy.loadError}</Alert>
      ) : loading ? (
        <Typography color="text.secondary">{copy.loading}</Typography>
      ) : !cohortId ? (
        <Alert severity="info">{copy.noSeason}</Alert>
      ) : groups.size === 0 ? (
        <Alert severity="info">{copy.empty}</Alert>
      ) : (
        <Stack spacing={3}>
          {Array.from(groups, ([mentorId, menteeIds]) => (
            <Box key={mentorId}>
              <Typography fontWeight={700} sx={{ mb: 1 }}>{copy.mentor}</Typography>
              <Grid container spacing={2} sx={{ mb: 2 }}>{member(mentorId)}</Grid>
              <Typography fontWeight={700} sx={{ mb: 1 }}>{copy.mentees}</Typography>
              <Grid container spacing={2}>{Array.from(menteeIds, member)}</Grid>
            </Box>
          ))}
        </Stack>
      )}
      <ProfileDialog profile={selected} onClose={() => setSelectedId(null)} />
    </Paper>
  );
}
