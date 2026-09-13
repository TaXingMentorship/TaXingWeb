"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Popover from "@mui/material/Popover";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import type { ParticipantRole, Profile } from "@/types/portal";
import { updateProfileIdentity } from "@/lib/portal/store";
import { portalCopy, profileLabels } from "@/data/portalCopy";
import { usePortalSession } from "@/components/portal/PortalSessionProvider";

/**
 * The 身份 cell of the roster, editable in place by an admin.
 *
 * Mentor and mentee are one choice, not two switches — `participant_role` holds
 * a single value, and offering two checkboxes would let an admin ask for a
 * state the column cannot store. Admin and volunteer are independent booleans
 * and are shown as such. That shape mirrors the composable identity model in
 * migration 0004 rather than inventing a friendlier lie on top of it.
 */
export default function IdentityCell({ profile }: { profile: Profile }) {
  const copy = portalCopy.roster;
  const queryClient = useQueryClient();
  // The real profile, not the persona projection: this warning is about the
  // actual account losing access, which a preview cannot change.
  const { realUser } = usePortalSession();

  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);
  const [role, setRole] = React.useState<ParticipantRole | null>(null);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [isVolunteer, setIsVolunteer] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const open = (event: React.MouseEvent<HTMLElement>) => {
    setRole(profile.participant_role);
    setIsAdmin(profile.is_admin);
    setIsVolunteer(profile.is_volunteer);
    setError(null);
    mutation.reset();
    setAnchor(event.currentTarget);
  };

  const mutation = useMutation({
    mutationFn: () =>
      updateProfileIdentity(profile.id, {
        participant_role: role,
        is_admin: isAdmin,
        is_volunteer: isVolunteer,
      }),
    onSuccess: () => {
      setAnchor(null);
      queryClient.invalidateQueries({ queryKey: ["portal", "profiles"] });
      queryClient.invalidateQueries({ queryKey: ["portal", "currentUser"] });
    },
  });

  const submit = () => {
    if (!role && !isAdmin && !isVolunteer) {
      setError(copy.identityRequired);
      return;
    }
    setError(null);
    mutation.mutate();
  };

  const labels = profileLabels(profile);
  const removingOwnAdmin =
    profile.id === realUser?.id && profile.is_admin && !isAdmin;

  return (
    <>
      <Chip
        size="small"
        label={labels.length > 0 ? labels.join(" · ") : copy.identityNone}
        color={profile.participant_role === "mentor" ? "primary" : "default"}
        variant="outlined"
        onClick={open}
        onDelete={open}
        deleteIcon={<EditOutlinedIcon />}
        aria-label={copy.editIdentity(profile.full_name ?? "")}
        sx={{ cursor: "pointer" }}
      />

      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Box sx={{ p: 2, width: 280 }}>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>
            {copy.identityTitle}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {copy.identityHint}
          </Typography>

          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            value={role}
            onChange={(_, next: ParticipantRole | null) => setRole(next)}
            sx={{ mt: 1.5 }}
            aria-label={copy.identityTitle}
          >
            <ToggleButton value="mentor">{copy.identityLabels.mentor}</ToggleButton>
            <ToggleButton value="mentee">{copy.identityLabels.mentee}</ToggleButton>
          </ToggleButtonGroup>

          <Stack sx={{ mt: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={isAdmin}
                  onChange={(event) => setIsAdmin(event.target.checked)}
                />
              }
              label={copy.identityLabels.admin}
            />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={isVolunteer}
                  onChange={(event) => setIsVolunteer(event.target.checked)}
                />
              }
              label={copy.identityLabels.volunteer}
            />
          </Stack>

          {removingOwnAdmin ? (
            <Alert severity="warning" sx={{ mt: 1 }}>
              {copy.identitySelfAdminWarning}
            </Alert>
          ) : null}
          {error ? (
            <Alert severity="error" sx={{ mt: 1 }}>
              {error}
            </Alert>
          ) : null}
          {mutation.isError ? (
            <Alert severity="error" sx={{ mt: 1 }}>
              {(mutation.error as Error).message}
            </Alert>
          ) : null}

          <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 2 }}>
            <Button size="small" onClick={() => setAnchor(null)}>
              {copy.cancel}
            </Button>
            <Button
              size="small"
              variant="contained"
              color="secondary"
              disabled={mutation.isPending}
              onClick={submit}
            >
              {copy.save}
            </Button>
          </Stack>
        </Box>
      </Popover>
    </>
  );
}
