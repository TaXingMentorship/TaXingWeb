"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import {
  getMyVolunteer,
  listCohorts,
  listVolunteerGroups,
  setMyVolunteerGroup,
} from "@/lib/portal/store";
import { portalCopy } from "@/data/portalCopy";

const NO_GROUP = "";

/**
 * The volunteer half of 我的资料: the seasons this account's volunteer record
 * spans, each with a group picker. Only the group is editable here — seasons
 * are added and removed by admins, and `is_lead` is theirs too. The write goes
 * through `set_my_volunteer_group` (migration 0016), which enforces the same
 * and logs the change.
 *
 * Renders nothing when the account has no linked volunteer record unless the
 * profile is flagged `is_volunteer`, in which case it explains who to ask.
 */
export default function MyVolunteerSection({
  profileId,
  isVolunteer,
  onSaved,
}: {
  profileId: string;
  isVolunteer: boolean;
  /** Fires after a successful change, so the caller can react (e.g. complete a task). */
  onSaved?: () => void;
}) {
  const copy = portalCopy.myVolunteer;
  const queryClient = useQueryClient();
  const [toast, setToast] = React.useState(false);

  const { data: volunteer, isLoading } = useQuery({
    queryKey: ["portal", "myVolunteer", profileId],
    queryFn: () => getMyVolunteer(profileId),
  });
  const { data: cohorts } = useQuery({
    queryKey: ["portal", "cohorts"],
    queryFn: listCohorts,
    enabled: Boolean(volunteer),
  });
  const { data: groups } = useQuery({
    queryKey: ["portal", "volunteerGroups"],
    queryFn: listVolunteerGroups,
    enabled: Boolean(volunteer),
  });

  const mutation = useMutation({
    mutationFn: ({ seasonId, groupId }: { seasonId: string; groupId: string | null }) =>
      setMyVolunteerGroup(seasonId, groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal", "myVolunteer", profileId] });
      queryClient.invalidateQueries({ queryKey: ["portal", "volunteers"] });
      setToast(true);
      onSaved?.();
    },
  });

  if (isLoading) return null;

  if (!volunteer) {
    if (!isVolunteer) return null;
    return (
      <Paper sx={{ p: 3, borderRadius: 3 }}>
        <Typography variant="h6" fontWeight={700} gutterBottom>
          {copy.title}
        </Typography>
        <Typography color="text.secondary">{copy.noRecord}</Typography>
      </Paper>
    );
  }

  const cohortById = new Map((cohorts ?? []).map((cohort) => [cohort.id, cohort]));
  const rows = volunteer.seasons
    .map((season) => ({ season, cohort: cohortById.get(season.cohort_id) }))
    .filter((row) => Boolean(row.cohort))
    .sort((a, b) =>
      (b.cohort!.starts_at ?? "").localeCompare(a.cohort!.starts_at ?? ""),
    );

  return (
    <Paper sx={{ p: 3, borderRadius: 3 }}>
      <Typography variant="h6" fontWeight={700} gutterBottom>
        {copy.title}
      </Typography>
      <Typography color="text.secondary" variant="body2" sx={{ mb: 2.5 }}>
        {copy.subtitle}
      </Typography>

      <Stack spacing={2}>
        {mutation.isError && (
          <Alert severity="error">
            {mutation.error instanceof Error ? mutation.error.message : "修改组别失败。"}
          </Alert>
        )}
        {rows.length === 0 && (
          <Typography color="text.secondary">{copy.loading}</Typography>
        )}
        {rows.map(({ season, cohort }) => (
          <Stack
            key={season.id}
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems={{ xs: "stretch", sm: "center" }}
          >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 160 }}>
              <Typography fontWeight={600}>{cohort!.name}</Typography>
              {season.is_lead && (
                <Chip size="small" color="secondary" label={copy.leadChip} />
              )}
            </Stack>
            <TextField
              select
              size="small"
              label={copy.groupColumn}
              value={season.group_id ?? NO_GROUP}
              onChange={(event) =>
                mutation.mutate({
                  seasonId: season.id,
                  groupId: event.target.value || null,
                })
              }
              disabled={mutation.isPending || !groups}
              helperText={season.is_lead ? copy.leadHint : undefined}
              sx={{ minWidth: 200 }}
            >
              {!season.is_lead && <MenuItem value={NO_GROUP}>{copy.noGroup}</MenuItem>}
              {(groups ?? []).map((group) => (
                <MenuItem key={group.id} value={group.id}>
                  {group.name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        ))}
      </Stack>

      <Snackbar
        open={toast}
        autoHideDuration={3000}
        onClose={() => setToast(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" onClose={() => setToast(false)}>
          {copy.saved}
        </Alert>
      </Snackbar>
    </Paper>
  );
}
