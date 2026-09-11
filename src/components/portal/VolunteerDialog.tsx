"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import Tooltip from "@mui/material/Tooltip";
import StarIcon from "@mui/icons-material/StarBorder";
import StarFilledIcon from "@mui/icons-material/Star";
import FormHelperText from "@mui/material/FormHelperText";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import Link from "@mui/material/Link";
import LinkIcon from "@mui/icons-material/Link";
import type {
  Cohort,
  ResolvedVolunteerWithSeasons,
  VolunteerGroup,
} from "@/types/portal";
import {
  createVolunteer,
  updateVolunteer,
  type VolunteerSeasonInput,
} from "@/lib/portal/store";
import { portalCopy } from "@/data/portalCopy";

/**
 * Newest season first, matching `listCohorts` and every other season list in
 * the portal. Without this the rows come out in insertion order, which reads as
 * random.
 */
function sortSeasons(
  seasons: VolunteerSeasonInput[],
  cohorts: Cohort[],
): VolunteerSeasonInput[] {
  const startsAt = new Map(cohorts.map((cohort) => [cohort.id, cohort.starts_at ?? ""]));
  return [...seasons].sort((a, b) =>
    (startsAt.get(b.cohort_id) ?? "").localeCompare(startsAt.get(a.cohort_id) ?? ""),
  );
}

/** Shared by create and edit — `volunteer` null means create. */
export default function VolunteerDialog({
  open,
  volunteer,
  cohorts,
  groups,
  onClose,
  onSaved,
}: {
  open: boolean;
  volunteer: ResolvedVolunteerWithSeasons | null;
  cohorts: Cohort[];
  groups: VolunteerGroup[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const copy = portalCopy.volunteers;

  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [wechat, setWechat] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [isPublic, setIsPublic] = React.useState(true);
  const [seasons, setSeasons] = React.useState<VolunteerSeasonInput[]>([]);
  const [validationError, setValidationError] = React.useState<string | null>(
    null,
  );

  React.useEffect(() => {
    if (!open) return;
    setFullName(volunteer?.own_full_name ?? "");
    setEmail(volunteer?.own_email ?? "");
    setWechat(volunteer?.own_wechat_number ?? "");
    setNotes(volunteer?.notes ?? "");
    setIsPublic(volunteer?.is_public ?? true);
    setSeasons(sortSeasons(
      volunteer?.seasons.map((season) => ({
        cohort_id: season.cohort_id,
        group_id: season.group_id,
        is_lead: season.is_lead,
      })) ?? [],
      cohorts,
    ));
    setValidationError(null);
  }, [open, volunteer, cohorts]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        full_name: fullName.trim(),
        email: email.trim() ? email.trim().toLowerCase() : null,
        wechat_number: wechat.trim() || null,
        notes: notes.trim() || null,
        is_public: isPublic,
        seasons,
      };
      return volunteer
        ? updateVolunteer(volunteer.id, payload)
        : createVolunteer(payload);
    },
    onSuccess: onSaved,
  });

  const addSeason = () => {
    const used = new Set(seasons.map((season) => season.cohort_id));
    const next = cohorts.find((cohort) => !used.has(cohort.id));
    if (!next) return;
    setSeasons((current) =>
      sortSeasons([...current, { cohort_id: next.id, group_id: null, is_lead: false }], cohorts),
    );
  };

  const updateSeason = (index: number, patch: Partial<VolunteerSeasonInput>) => {
    setSeasons((current) => {
      const next = current.map((season, i) =>
        i === index ? { ...season, ...patch } : season,
      );
      // Re-sort only when the season itself moved; re-sorting on every group
      // change would make the row jump under the cursor mid-edit.
      return patch.cohort_id ? sortSeasons(next, cohorts) : next;
    });
  };

  const removeSeason = (index: number) => {
    setSeasons((current) => current.filter((_, i) => i !== index));
  };

  const submit = () => {
    if (!fullName.trim()) {
      setValidationError(copy.nameRequired);
      return;
    }
    if (seasons.length === 0) {
      setValidationError(copy.seasonRequired);
      return;
    }
    const cohortIds = seasons.map((season) => season.cohort_id);
    if (new Set(cohortIds).size !== cohortIds.length) {
      setValidationError(copy.duplicateSeason);
      return;
    }
    setValidationError(null);
    mutation.mutate();
  };

  const allSeasonsUsed = seasons.length >= cohorts.length;
  // When a portal account is linked, that account is the source of truth for
  // identity and contact details (migration 0012). Editing them here would be a
  // lie — the resolved view would keep showing the profile's values.
  const linked = Boolean(volunteer?.profile_id);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {volunteer ? copy.editTitle : copy.createTitle}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {validationError ? (
            <Alert severity="error">{validationError}</Alert>
          ) : null}
          {mutation.isError ? (
            <Alert severity="error">{(mutation.error as Error).message}</Alert>
          ) : null}

          {linked ? (
            <Alert
              severity="info"
              icon={<LinkIcon fontSize="inherit" />}
              action={
                <Link href="/portal/directory" variant="body2" underline="hover">
                  {copy.linkedProfileLink}
                </Link>
              }
            >
              {copy.linkedHint}
            </Alert>
          ) : null}

          <TextField
            label={copy.nameLabel}
            helperText={
              linked
                ? copy.ownValueHint(volunteer?.own_full_name ?? "")
                : copy.nameHelper
            }
            value={linked ? (volunteer?.full_name ?? "") : fullName}
            onChange={(event) => setFullName(event.target.value)}
            fullWidth
            required
            autoFocus={!linked}
            autoComplete="name"
            disabled={linked}
          />
          <TextField
            label={copy.emailLabel}
            helperText={linked ? undefined : copy.emailHelper}
            type="email"
            spellCheck={false}
            autoComplete="email"
            value={linked ? (volunteer?.email ?? "") : email}
            onChange={(event) => setEmail(event.target.value)}
            fullWidth
            disabled={linked}
            slotProps={{ htmlInput: { inputMode: "email" } }}
          />
          <TextField
            label={copy.wechatLabel}
            spellCheck={false}
            autoComplete="off"
            value={linked ? (volunteer?.wechat_number ?? "") : wechat}
            onChange={(event) => setWechat(event.target.value)}
            fullWidth
            disabled={linked}
          />

          <Box>
            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
              {copy.seasonsLabel}
            </Typography>
            <Stack spacing={1.5}>
              {seasons.map((season, index) => (
                <Stack
                  key={`${season.cohort_id}-${index}`}
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  alignItems={{ sm: "center" }}
                >
                  <TextField
                    select
                    size="small"
                    label={copy.seasonLabel}
                    value={season.cohort_id}
                    onChange={(event) =>
                      updateSeason(index, { cohort_id: event.target.value })
                    }
                    sx={{ flex: 1, minWidth: 0 }}
                  >
                    {cohorts.map((cohort) => (
                      <MenuItem key={cohort.id} value={cohort.id}>
                        {cohort.name}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    select
                    size="small"
                    label={copy.columns.group}
                    value={season.group_id ?? ""}
                    onChange={(event) =>
                      updateSeason(index, {
                        group_id: event.target.value || null,
                        ...(event.target.value ? {} : { is_lead: false }),
                      })
                    }
                    sx={{ flex: 1, minWidth: 0 }}
                  >
                    <MenuItem value="">{copy.groupPlaceholder}</MenuItem>
                    {groups.map((group) => (
                      <MenuItem key={group.id} value={group.id}>
                        {group.name}
                      </MenuItem>
                    ))}
                  </TextField>
                  {/* One click, per season — a lead of 运营组 in 2026春季 is
                      thereby also in 战略组 that season, without a second row. */}
                  <Tooltip title={copy.leadHint}>
                    <FormControlLabel
                      sx={{ mr: 0, ml: 0, whiteSpace: "nowrap" }}
                      control={
                        <Checkbox
                          size="small"
                          checked={season.is_lead}
                          disabled={!season.group_id}
                          icon={<StarIcon fontSize="small" />}
                          checkedIcon={<StarFilledIcon fontSize="small" color="warning" />}
                          onChange={(event) =>
                            updateSeason(index, { is_lead: event.target.checked })
                          }
                          inputProps={{ "aria-label": copy.leadLabel }}
                        />
                      }
                      label={
                        <Typography variant="caption">{copy.leadLabel}</Typography>
                      }
                    />
                  </Tooltip>
                  <IconButton
                    aria-label={`${copy.removeSeason}`}
                    onClick={() => removeSeason(index)}
                    sx={{ alignSelf: { xs: "flex-end", sm: "center" } }}
                  >
                    <DeleteOutlineIcon />
                  </IconButton>
                </Stack>
              ))}
              <Box>
                <Button
                  startIcon={<AddIcon />}
                  onClick={addSeason}
                  disabled={allSeasonsUsed}
                  size="small"
                >
                  {copy.addSeason}
                </Button>
              </Box>
              <FormHelperText>{copy.seasonsHelper}</FormHelperText>
            </Stack>
          </Box>

          <TextField
            label={copy.notesLabel}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            fullWidth
            multiline
            minRows={2}
          />
          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={isPublic}
                  onChange={(event) => setIsPublic(event.target.checked)}
                />
              }
              label={copy.isPublicLabel}
            />
            <FormHelperText>{copy.notPublicHint}</FormHelperText>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{copy.cancel}</Button>
        <Button
          variant="contained"
          color="secondary"
          disabled={mutation.isPending}
          onClick={submit}
        >
          {copy.save}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
