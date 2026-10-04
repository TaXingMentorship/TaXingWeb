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
import ListSubheader from "@mui/material/ListSubheader";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormHelperText from "@mui/material/FormHelperText";
import type {
  Cohort,
  Profile,
  ResolvedVolunteerWithSeasons,
  TaskWithAssignments,
  VolunteerGroup,
} from "@/types/portal";
import { createTask, updateTask, type TaskInput } from "@/lib/portal/store";
import { participantRoleLabels, portalCopy } from "@/data/portalCopy";

type RecipientMode =
  | "individuals"
  | "group"
  | "season"
  | "members"
  | "mentors"
  | "mentees"
  | "participants";

const VOLUNTEER_MODES: RecipientMode[] = ["individuals", "group", "season"];
const MEMBER_MODES: RecipientMode[] = ["members", "mentors", "mentees", "participants"];
const PICK_MODES: RecipientMode[] = ["individuals", "members"];
const DYNAMIC_MEMBER_MODES: RecipientMode[] = ["mentors", "mentees", "participants"];
const DYNAMIC_MODES: RecipientMode[] = [...DYNAMIC_MEMBER_MODES, "season", "group"];

const CUSTOM = "custom";
const ALL_SEASONS = "";

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

/** The recipient mode a saved task was created with. */
function modeOfTask(task: TaskWithAssignments): RecipientMode {
  const roles = task.audience_roles;
  if (roles.length > 1) return "participants";
  if (roles[0] === "mentor") return "mentors";
  if (roles[0] === "mentee") return "mentees";
  if (task.audience_volunteers) return task.audience_group_id ? "group" : "season";
  return task.assignments.some((assignment) => assignment.volunteer_id)
    ? "individuals"
    : "members";
}

/**
 * What an edit may change the audience into. Assignments are never revoked,
 * so only widening is offered; fixed lists stay fixed and just gain people.
 */
const WIDER_MODES: Record<RecipientMode, RecipientMode[]> = {
  individuals: ["individuals"],
  members: ["members"],
  group: ["group", "season"],
  season: ["season"],
  mentors: ["mentors", "participants"],
  mentees: ["mentees", "participants"],
  participants: ["participants"],
};

export default function TaskDialog({
  open,
  task = null,
  volunteers,
  profiles,
  cohorts,
  groups,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** Set to edit a published task instead of creating one. */
  task?: TaskWithAssignments | null;
  volunteers: ResolvedVolunteerWithSeasons[];
  /** Portal accounts, for the 导师与学员 modes. */
  profiles: Profile[];
  cohorts: Cohort[];
  groups: VolunteerGroup[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const copy = portalCopy.adminTasks;
  const isEdit = Boolean(task);

  const [preset, setPreset] = React.useState<string>(CUSTOM);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [link, setLink] = React.useState("");
  const [dueOn, setDueOn] = React.useState("");
  const [mode, setMode] = React.useState<RecipientMode>("individuals");
  // "" means "the first one" for the whole-season modes and "all seasons" for
  // the pick modes — resolved below rather than stored, so a refetch of
  // cohorts/groups (React Query refetches on window focus) cannot reset the
  // form mid-edit. Pick modes start on the newest season, which is what the
  // reviewer asked for: the full roster is too long to scan.
  const [cohortChoice, setCohortChoice] = React.useState<string | null>(null);
  const [groupChoice, setGroupChoice] = React.useState("");
  const [pickedVolunteers, setPickedVolunteers] = React.useState<
    ResolvedVolunteerWithSeasons[]
  >([]);
  const [pickedProfiles, setPickedProfiles] = React.useState<Profile[]>([]);
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const [notifyAll, setNotifyAll] = React.useState(false);

  // People already on the task: kept locked in the pickers, and what the
  // preview measures "added" against.
  const assignedVolunteerIds = React.useMemo(
    () => new Set((task?.assignments ?? []).flatMap((a) => (a.volunteer_id ? [a.volunteer_id] : []))),
    [task],
  );
  const assignedProfileIds = React.useMemo(
    () => new Set((task?.assignments ?? []).flatMap((a) => (a.profile_id ? [a.profile_id] : []))),
    [task],
  );

  const isPickMode = PICK_MODES.includes(mode);
  const isDynamicMemberMode = DYNAMIC_MEMBER_MODES.includes(mode);
  const isDynamicMode = DYNAMIC_MODES.includes(mode);
  const newestCohortId = cohorts[0]?.id ?? "";
  const cohortId = cohortChoice ?? newestCohortId;
  const groupId = groupChoice || (groups[0]?.id ?? "");

  // Resets (or prefills) only when the dialog opens or switches task: React
  // Query refetches `volunteers` / `profiles` on window focus, and that must
  // not wipe a form mid-edit.
  React.useEffect(() => {
    if (!open) return;
    setPreset(CUSTOM);
    setValidationError(null);
    setNotifyAll(false);
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setLink(task.link ?? "");
      setDueOn(task.due_on ?? "");
      setMode(modeOfTask(task));
      setCohortChoice(task.cohort_id ?? ALL_SEASONS);
      setGroupChoice(task.audience_group_id ?? "");
      setPickedVolunteers(volunteers.filter((volunteer) => assignedVolunteerIds.has(volunteer.id)));
      setPickedProfiles(profiles.filter((profile) => assignedProfileIds.has(profile.id)));
      return;
    }
    setTitle("");
    setDescription("");
    setLink("");
    setDueOn("");
    setMode("individuals");
    setCohortChoice(null);
    setGroupChoice("");
    setPickedVolunteers([]);
    setPickedProfiles([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task]);

  const applyPreset = (key: string) => {
    setPreset(key);
    const found = copy.presets.find((item) => item.key === key);
    if (!found) return;
    setTitle(found.title);
    setDescription(found.description);
    setLink(found.link);
  };

  const groupById = React.useMemo(
    () => new Map(groups.map((group) => [group.id, group])),
    [groups],
  );

  // Candidates for the pick modes, narrowed by season.
  const volunteerOptions = React.useMemo(() => {
    if (cohortId === ALL_SEASONS) return volunteers;
    return volunteers.filter((volunteer) =>
      volunteer.seasons.some((season) => season.cohort_id === cohortId),
    );
  }, [volunteers, cohortId]);

  const profileOptions = React.useMemo(() => {
    const members = profiles.filter((profile) => profile.participant_role);
    if (cohortId === ALL_SEASONS) return members;
    return members.filter((profile) => profile.cohort_ids.includes(cohortId));
  }, [profiles, cohortId]);

  const volunteerLabel = (volunteer: ResolvedVolunteerWithSeasons) => {
    const season =
      cohortId === ALL_SEASONS
        ? undefined
        : volunteer.seasons.find((item) => item.cohort_id === cohortId);
    const group = season?.group_id ? groupById.get(season.group_id) : undefined;
    return group ? `${volunteer.full_name} · ${group.name}` : volunteer.full_name;
  };

  const profileLabel = (profile: Profile) =>
    profile.participant_role
      ? `${profile.full_name ?? ""} · ${participantRoleLabels[profile.participant_role]}`
      : (profile.full_name ?? "");

  // The recipients exactly as they will be posted — the preview below is the
  // same list, not an estimate.
  const recipients = React.useMemo((): {
    volunteers: ResolvedVolunteerWithSeasons[];
    profiles: Profile[];
  } => {
    switch (mode) {
      case "individuals":
        return { volunteers: pickedVolunteers, profiles: [] };
      case "members":
        return { volunteers: [], profiles: pickedProfiles };
      case "season":
        return {
          volunteers: volunteers.filter((volunteer) =>
            volunteer.seasons.some((season) => season.cohort_id === cohortId),
          ),
          profiles: [],
        };
      case "group": {
        const group = groupById.get(groupId);
        return {
          volunteers: group ? volunteersInGroup(volunteers, cohortId, group) : [],
          profiles: [],
        };
      }
      case "mentors":
      case "mentees":
      case "participants": {
        const roles =
          mode === "participants"
            ? ["mentor", "mentee"]
            : [mode === "mentors" ? "mentor" : "mentee"];
        return {
          volunteers: [],
          profiles: profiles.filter(
            (profile) =>
              profile.participant_role !== null &&
              roles.includes(profile.participant_role) &&
              profile.cohort_ids.includes(cohortId),
          ),
        };
      }
    }
  }, [mode, pickedVolunteers, pickedProfiles, volunteers, profiles, cohortId, groupId, groupById]);

  const recipientCount = recipients.volunteers.length + recipients.profiles.length;
  const withoutAccount = recipients.volunteers.filter((volunteer) => !volunteer.profile_id).length;

  const contentChanged =
    task !== null &&
    (title.trim() !== task.title ||
      (description.trim() || null) !== task.description ||
      (link.trim() || null) !== task.link ||
      dueOn !== (task.due_on ?? ""));
  const assignmentsDone = task?.assignments.filter((a) => a.completed_at).length ?? 0;
  const assignmentsPending = (task?.assignments.length ?? 0) - assignmentsDone;
  const addedCount = isEdit
    ? recipients.volunteers.filter((volunteer) => !assignedVolunteerIds.has(volunteer.id)).length +
      recipients.profiles.filter((profile) => {
        if (assignedProfileIds.has(profile.id)) return false;
        const linked = volunteers.find((volunteer) => volunteer.profile_id === profile.id);
        return !(linked && assignedVolunteerIds.has(linked.id));
      }).length
    : 0;

  const mutation = useMutation({
    mutationFn: () => {
      const input: TaskInput = {
        title: title.trim(),
        description: description.trim() || null,
        link: link.trim() || null,
        due_on: dueOn,
        cohort_id: isPickMode ? null : cohortId || null,
        audience_roles:
          mode === "participants"
            ? ["mentor", "mentee"]
            : mode === "mentors"
              ? ["mentor"]
              : mode === "mentees"
                ? ["mentee"]
                : [],
        audience_volunteers: mode === "season" || mode === "group",
        audience_group_id: mode === "group" ? groupId : null,
        volunteer_ids:
          mode === "season" || mode === "group" ? [] : recipients.volunteers.map((volunteer) => volunteer.id),
        profile_ids: isDynamicMemberMode
          ? []
          : recipients.profiles.map((profile) => profile.id),
      };
      return task ? updateTask(task.id, input, notifyAll) : createTask(input);
    },
    onSuccess: onSaved,
  });

  const submit = () => {
    if (!title.trim()) {
      setValidationError(copy.titleRequired);
      return;
    }
    if (!dueOn) {
      setValidationError(copy.dueRequired);
      return;
    }
    if (recipientCount === 0 && !isDynamicMode) {
      setValidationError(copy.recipientsRequired);
      return;
    }
    setValidationError(null);
    mutation.mutate();
  };

  // Changing the season also drops picked people who are not in it — the
  // season is a constraint on the recipients, not just a filter on the list,
  // so nobody from another season rides along unseen.
  const changeSeason = (next: string) => {
    setCohortChoice(next);
    if (next === ALL_SEASONS) return;
    setPickedVolunteers((current) =>
      current.filter((volunteer) =>
        volunteer.seasons.some((season) => season.cohort_id === next),
      ),
    );
    setPickedProfiles((current) =>
      current.filter((profile) => profile.cohort_ids.includes(next)),
    );
  };

  // Fixed recipients already on the task cannot be removed from the pickers.
  const keepAssigned = <T extends { id: string }>(
    next: T[],
    all: T[],
    assigned: Set<string>,
  ) => [...all.filter((item) => assigned.has(item.id)), ...next.filter((item) => !assigned.has(item.id))];

  const allowedModes = task ? WIDER_MODES[modeOfTask(task)] : [...VOLUNTEER_MODES, ...MEMBER_MODES];
  const volunteerModes = VOLUNTEER_MODES.filter((key) => allowedModes.includes(key));
  const memberModes = MEMBER_MODES.filter((key) => allowedModes.includes(key));

  const changeMode = (next: RecipientMode) => {
    setMode(next);
    // "All seasons" only exists for the pick modes; a whole-season mode needs
    // a season.
    if (!PICK_MODES.includes(next) && cohortId === ALL_SEASONS) setCohortChoice(null);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? copy.editTitle : copy.createTitle}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {validationError ? <Alert severity="error">{validationError}</Alert> : null}
          {mutation.isError ? (
            <Alert severity="error">{(mutation.error as Error).message}</Alert>
          ) : null}

          {isEdit && <Alert severity="info">{copy.editLockedHint}</Alert>}
          {!isEdit && (
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
          )}
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
            required
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
            onChange={(event) => changeMode(event.target.value as RecipientMode)}
            disabled={isEdit && allowedModes.length === 1}
            fullWidth
          >
            {volunteerModes.length > 0 && (
              <ListSubheader>{copy.recipientGroups.volunteers}</ListSubheader>
            )}
            {volunteerModes.map((key) => (
              <MenuItem key={key} value={key}>
                {copy.recipientModes[key]}
              </MenuItem>
            ))}
            {memberModes.length > 0 && (
              <ListSubheader>{copy.recipientGroups.members}</ListSubheader>
            )}
            {memberModes.map((key) => (
              <MenuItem key={key} value={key}>
                {copy.recipientModes[key]}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label={copy.seasonLabel}
            value={cohortId}
            onChange={(event) => changeSeason(event.target.value)}
            disabled={isEdit}
            helperText={isPickMode ? copy.seasonFilterHelper : undefined}
            slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
            fullWidth
          >
            {isPickMode && <MenuItem value={ALL_SEASONS}>{copy.allSeasons}</MenuItem>}
            {cohorts.map((cohort) => (
              <MenuItem key={cohort.id} value={cohort.id}>
                {cohort.name}
              </MenuItem>
            ))}
          </TextField>
          {mode === "group" && (
            <TextField
              select
              label={copy.groupLabel}
              value={groupId}
              onChange={(event) => setGroupChoice(event.target.value)}
              disabled={isEdit}
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
              options={volunteerOptions}
              value={pickedVolunteers}
              onChange={(_, value) =>
                setPickedVolunteers(keepAssigned(value, pickedVolunteers, assignedVolunteerIds))
              }
              renderTags={(value, getTagProps) =>
                value.map((option, index) => {
                  const { key, onDelete, ...tagProps } = getTagProps({ index });
                  return (
                    <Chip
                      key={key}
                      {...tagProps}
                      size="small"
                      label={volunteerLabel(option)}
                      onDelete={assignedVolunteerIds.has(option.id) ? undefined : onDelete}
                    />
                  );
                })
              }
              getOptionLabel={volunteerLabel}
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
          {mode === "members" && (
            <Autocomplete
              multiple
              options={profileOptions}
              value={pickedProfiles}
              onChange={(_, value) =>
                setPickedProfiles(keepAssigned(value, pickedProfiles, assignedProfileIds))
              }
              renderTags={(value, getTagProps) =>
                value.map((option, index) => {
                  const { key, onDelete, ...tagProps } = getTagProps({ index });
                  return (
                    <Chip
                      key={key}
                      {...tagProps}
                      size="small"
                      label={profileLabel(option)}
                      onDelete={assignedProfileIds.has(option.id) ? undefined : onDelete}
                    />
                  );
                })
              }
              getOptionLabel={profileLabel}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={copy.membersLabel}
                  placeholder={copy.membersPlaceholder}
                />
              )}
            />
          )}

          <Alert severity={recipientCount === 0 ? "warning" : "info"}>
            {recipientCount === 0
              ? isDynamicMode
                ? copy.previewDynamicEmpty
                : copy.previewEmpty
              : copy.previewCount(recipientCount)}
            {isDynamicMode && (
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {mode === "season" || mode === "group"
                  ? copy.previewDynamicVolunteers
                  : copy.previewDynamic}
              </Typography>
            )}
            {withoutAccount > 0 && (
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {copy.previewNoAccount(withoutAccount)}
              </Typography>
            )}
          </Alert>

          {isEdit && (
            <Stack spacing={0.5}>
              <Alert severity="info">
                {copy.editPreview(
                  addedCount,
                  contentChanged,
                  assignmentsPending,
                  assignmentsDone,
                  notifyAll,
                )}
              </Alert>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={notifyAll}
                    onChange={(event) => setNotifyAll(event.target.checked)}
                  />
                }
                label={copy.notifyAllLabel}
              />
              <FormHelperText sx={{ mt: -0.5, ml: 4 }}>{copy.notifyAllHint}</FormHelperText>
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{copy.cancel}</Button>
        <Button variant="contained" color="secondary" onClick={submit} disabled={mutation.isPending}>
          {isEdit ? copy.saveEdit : copy.create}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
