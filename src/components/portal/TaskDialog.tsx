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
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import type {
  Cohort,
  ResolvedVolunteerWithSeasons,
  VolunteerGroup,
} from "@/types/portal";
import { createTask } from "@/lib/portal/store";
import { portalCopy } from "@/data/portalCopy";

type RecipientMode = "individuals" | "group" | "season";

const CUSTOM = "custom";

/**
 * Members of a group in a season, including the leads a `includes_leads`
 * group carries — the same rule the roster page uses for its tabs.
 */
export function volunteersInGroup(
  volunteers: ResolvedVolunteerWithSeasons[],
  cohortId: string,
  group: VolunteerGroup,
): ResolvedVolunteerWithSeasons[] {
  return volunteers.filter((volunteer) =>
    volunteer.seasons.some(
      (season) =>
        season.cohort_id === cohortId &&
        (season.group_id === group.id || (group.includes_leads && season.is_lead)),
    ),
  );
}

export default function TaskDialog({
  open,
  volunteers,
  cohorts,
  groups,
  onClose,
  onSaved,
}: {
  open: boolean;
  volunteers: ResolvedVolunteerWithSeasons[];
  cohorts: Cohort[];
  groups: VolunteerGroup[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const copy = portalCopy.adminTasks;

  const [preset, setPreset] = React.useState<string>(CUSTOM);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [link, setLink] = React.useState("");
  const [dueOn, setDueOn] = React.useState("");
  const [mode, setMode] = React.useState<RecipientMode>("individuals");
  // "" means "the first one" — resolved below rather than stored, so a refetch
  // of cohorts/groups (React Query refetches on window focus) cannot reset the
  // form mid-edit.
  const [cohortChoice, setCohortChoice] = React.useState("");
  const [groupChoice, setGroupChoice] = React.useState("");
  const cohortId = cohortChoice || (cohorts[0]?.id ?? "");
  const groupId = groupChoice || (groups[0]?.id ?? "");
  const [picked, setPicked] = React.useState<ResolvedVolunteerWithSeasons[]>([]);
  const [validationError, setValidationError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setPreset(CUSTOM);
    setTitle("");
    setDescription("");
    setLink("");
    setDueOn("");
    setMode("individuals");
    setCohortChoice("");
    setGroupChoice("");
    setPicked([]);
    setValidationError(null);
  }, [open]);

  const applyPreset = (key: string) => {
    setPreset(key);
    const found = copy.presets.find((item) => item.key === key);
    if (!found) return;
    setTitle(found.title);
    setDescription(found.description);
    setLink(found.link);
  };

  // The recipients exactly as they will be posted — the preview below is the
  // same list, not an estimate.
  const recipients = React.useMemo(() => {
    if (mode === "individuals") return picked;
    if (!cohortId) return [];
    if (mode === "season") {
      return volunteers.filter((volunteer) =>
        volunteer.seasons.some((season) => season.cohort_id === cohortId),
      );
    }
    const group = groups.find((item) => item.id === groupId);
    return group ? volunteersInGroup(volunteers, cohortId, group) : [];
  }, [mode, picked, cohortId, groupId, volunteers, groups]);

  const withoutAccount = recipients.filter((volunteer) => !volunteer.profile_id).length;

  const mutation = useMutation({
    mutationFn: () =>
      createTask({
        title: title.trim(),
        description: description.trim() || null,
        link: link.trim() || null,
        due_on: dueOn || null,
        cohort_id: mode === "individuals" ? null : cohortId || null,
        volunteer_ids: recipients.map((volunteer) => volunteer.id),
      }),
    onSuccess: onSaved,
  });

  const submit = () => {
    if (!title.trim()) {
      setValidationError(copy.titleRequired);
      return;
    }
    if (recipients.length === 0) {
      setValidationError(copy.recipientsRequired);
      return;
    }
    setValidationError(null);
    mutation.mutate();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{copy.createTitle}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {validationError ? <Alert severity="error">{validationError}</Alert> : null}
          {mutation.isError ? (
            <Alert severity="error">{(mutation.error as Error).message}</Alert>
          ) : null}

          <TextField
            select
            label={copy.presetLabel}
            value={preset}
            onChange={(event) => applyPreset(event.target.value)}
            fullWidth
          >
            <MenuItem value={CUSTOM}>{copy.presetCustom}</MenuItem>
            {copy.presets.map((item) => (
              <MenuItem key={item.key} value={item.key}>
                {item.title}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={copy.titleLabel}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            fullWidth
          />
          <TextField
            label={copy.descriptionLabel}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            fullWidth
            multiline
            minRows={2}
          />
          <TextField
            label={copy.linkLabel}
            helperText={copy.linkHelper}
            value={link}
            onChange={(event) => setLink(event.target.value)}
            fullWidth
            placeholder="/portal/me"
          />
          <TextField
            label={copy.dueLabel}
            type="date"
            value={dueOn}
            onChange={(event) => setDueOn(event.target.value)}
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />

          <Divider />
          <Typography variant="subtitle2" fontWeight={700}>
            {copy.recipientsLabel}
          </Typography>
          <TextField
            select
            label={copy.recipientModeLabel}
            value={mode}
            onChange={(event) => setMode(event.target.value as RecipientMode)}
            fullWidth
          >
            {(Object.keys(copy.recipientModes) as RecipientMode[]).map((key) => (
              <MenuItem key={key} value={key}>
                {copy.recipientModes[key]}
              </MenuItem>
            ))}
          </TextField>

          {mode !== "individuals" && (
            <TextField
              select
              label={copy.seasonLabel}
              value={cohortId}
              onChange={(event) => setCohortChoice(event.target.value)}
              fullWidth
            >
              {cohorts.map((cohort) => (
                <MenuItem key={cohort.id} value={cohort.id}>
                  {cohort.name}
                </MenuItem>
              ))}
            </TextField>
          )}
          {mode === "group" && (
            <TextField
              select
              label={copy.groupLabel}
              value={groupId}
              onChange={(event) => setGroupChoice(event.target.value)}
              fullWidth
            >
              {groups.map((group) => (
                <MenuItem key={group.id} value={group.id}>
                  {group.name}
                </MenuItem>
              ))}
            </TextField>
          )}
          {mode === "individuals" && (
            <Autocomplete
              multiple
              options={volunteers}
              value={picked}
              onChange={(_, value) => setPicked(value)}
              getOptionLabel={(option) => option.full_name}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={copy.volunteersLabel}
                  placeholder={copy.volunteersPlaceholder}
                />
              )}
            />
          )}

          <Alert severity={recipients.length === 0 ? "warning" : "info"}>
            {recipients.length === 0 ? copy.previewEmpty : copy.previewCount(recipients.length)}
            {withoutAccount > 0 && (
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {copy.previewNoAccount(withoutAccount)}
              </Typography>
            )}
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{copy.cancel}</Button>
        <Button variant="contained" color="secondary" onClick={submit} disabled={mutation.isPending}>
          {copy.create}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
