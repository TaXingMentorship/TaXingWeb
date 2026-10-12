"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import type { Cohort, MentorGroupChangeRequest } from "@/types/portal";
import {
  listCohorts,
  listMentorGroupMembers,
  listMentorGroups,
  markMentorGroupChangesSeen,
  requestMentorGroupChange,
  withdrawMentorGroupChange,
} from "@/lib/portal/store";
import { portalCopy } from "@/data/portalCopy";
import { usePortalSession } from "@/components/portal/PortalSessionProvider";
import {
  MY_GROUP_CHANGES_KEY,
  PENDING_GROUP_CHANGES_KEY,
  useMyMentorGroupChanges,
} from "@/components/portal/useMentorGroupChanges";

/**
 * A mentor's answer group on 我的资料, one line per season that has groups.
 *
 * It is read-only: `mentor_group_members` is writable by admins only. A mentor
 * asks for a different group with a reason, and sees the latest request's state
 * underneath — waiting, approved, or rejected with the admin's note. A decision
 * is shown once and then marked seen, which clears the dot on the sidebar item.
 */
export default function MentorGroupField() {
  const copy = portalCopy.mentorGroupChange;
  const queryClient = useQueryClient();
  // Follows the persona preview for what is shown; the database checks the
  // real account.
  const { currentUser, realUser } = usePortalSession();
  const isMentor = currentUser?.participant_role === "mentor";

  const { data: cohorts } = useQuery({
    queryKey: ["portal", "cohorts"],
    queryFn: listCohorts,
    enabled: isMentor,
  });
  const { data: groups } = useQuery({
    queryKey: ["portal", "mentorGroups", "all"],
    queryFn: () => listMentorGroups(),
    enabled: isMentor,
  });
  const { data: members } = useQuery({
    queryKey: ["portal", "mentorGroupMembers", "all"],
    queryFn: () => listMentorGroupMembers(),
    enabled: isMentor,
  });
  const { requests, unseen } = useMyMentorGroupChanges();

  const [dialogCohort, setDialogCohort] = React.useState<string | null>(null);
  const [toGroupId, setToGroupId] = React.useState("");
  const [reason, setReason] = React.useState("");

  // Hold the decision on screen for this visit, then mark it seen.
  const [decision, setDecision] = React.useState<MentorGroupChangeRequest | null>(null);
  const seenMutation = useMutation({
    mutationFn: markMentorGroupChangesSeen,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MY_GROUP_CHANGES_KEY }),
  });
  const { mutate: markSeen } = seenMutation;
  React.useEffect(() => {
    if (!isMentor || decision || unseen.length === 0) return;
    setDecision(unseen[0]);
    markSeen();
  }, [isMentor, unseen, decision, markSeen]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: MY_GROUP_CHANGES_KEY });
    queryClient.invalidateQueries({ queryKey: PENDING_GROUP_CHANGES_KEY });
    queryClient.invalidateQueries({ queryKey: ["portal", "mentorGroupMembers"] });
  };

  const submit = useMutation({
    mutationFn: () =>
      requestMentorGroupChange({
        cohortId: dialogCohort!,
        toGroupId,
        reason: reason.trim(),
      }),
    onSuccess: () => {
      setDialogCohort(null);
      setDecision(null);
      refresh();
    },
  });

  const withdraw = useMutation({
    mutationFn: withdrawMentorGroupChange,
    onSuccess: refresh,
  });

  const groupName = React.useMemo(
    () => new Map((groups ?? []).map((g) => [g.id, g.name])),
    [groups],
  );

  // Seasons the mentor is in that actually have answer groups, newest first.
  const seasons = React.useMemo(() => {
    const withGroups = new Set((groups ?? []).map((g) => g.cohort_id));
    return (cohorts ?? [])
      .filter(
        (c: Cohort) =>
          (currentUser?.cohort_ids ?? []).includes(c.id) && withGroups.has(c.id),
      )
      .sort((a, b) => (b.starts_at ?? "").localeCompare(a.starts_at ?? ""));
  }, [cohorts, groups, currentUser?.cohort_ids]);

  if (!isMentor || seasons.length === 0) return null;

  const myGroupIn = (cohortId: string) =>
    (members ?? []).find(
      (m) => m.cohort_id === cohortId && m.profile_id === (realUser?.id ?? currentUser?.id),
    )?.group_id ?? null;

  const openDialog = (cohortId: string) => {
    setToGroupId("");
    setReason("");
    submit.reset();
    setDialogCohort(cohortId);
  };

  const dialogCurrent = dialogCohort ? myGroupIn(dialogCohort) : null;
  const dialogOptions = (groups ?? []).filter(
    (g) => g.cohort_id === dialogCohort && g.id !== dialogCurrent,
  );
  const canSubmit = toGroupId !== "" && reason.trim() !== "";

  return (
    <Stack spacing={1.5}>
      {seasons.map((season) => {
        const current = myGroupIn(season.id);
        const pending = requests.find(
          (r) => r.cohort_id === season.id && r.status === "pending",
        );
        const decided =
          !pending && decision && decision.cohort_id === season.id ? decision : null;
        return (
          <Stack key={season.id} spacing={1.5}>
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <TextField
                label={copy.fieldLabel(season.name)}
                value={current ? (groupName.get(current) ?? "") : copy.unassigned}
                fullWidth
                disabled
                helperText={copy.lockedHint}
              />
              <Button
                variant="outlined"
                onClick={() => openDialog(season.id)}
                disabled={Boolean(pending)}
                sx={{ flexShrink: 0, height: 56, whiteSpace: "nowrap" }}
              >
                {copy.requestButton}
              </Button>
            </Stack>

            {pending && (
              <Alert
                severity="info"
                action={
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => withdraw.mutate(season.id)}
                    disabled={withdraw.isPending}
                  >
                    {copy.withdraw}
                  </Button>
                }
              >
                {copy.pending(groupName.get(pending.to_group_id) ?? "")}
              </Alert>
            )}
            {decided && (
              <Alert
                severity={decided.status === "approved" ? "success" : "warning"}
                onClose={() => setDecision(null)}
              >
                {decided.status === "approved"
                  ? copy.approved(groupName.get(decided.to_group_id) ?? "")
                  : copy.rejected(
                      groupName.get(decided.to_group_id) ?? "",
                      decided.review_note ?? "",
                    )}
              </Alert>
            )}
          </Stack>
        );
      })}
      {withdraw.isError && (
        <Alert severity="error">
          {withdraw.error instanceof Error ? withdraw.error.message : "撤回失败。"}
        </Alert>
      )}

      <Dialog
        open={Boolean(dialogCohort)}
        onClose={() => setDialogCohort(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>{copy.dialogTitle}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {submit.isError && (
              <Alert severity="error">
                {submit.error instanceof Error ? submit.error.message : "提交失败。"}
              </Alert>
            )}
            <TextField
              label={copy.currentLabel}
              value={dialogCurrent ? (groupName.get(dialogCurrent) ?? "") : copy.unassigned}
              disabled
              fullWidth
            />
            <TextField
              select
              label={copy.newGroupLabel}
              value={toGroupId}
              onChange={(event) => setToGroupId(event.target.value)}
              required
              fullWidth
            >
              {dialogOptions.map((g) => (
                <MenuItem key={g.id} value={g.id}>
                  {g.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label={copy.reasonLabel}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
              fullWidth
              multiline
              minRows={3}
              helperText={copy.reasonHint}
              inputProps={{ maxLength: 500 }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogCohort(null)}>{copy.cancel}</Button>
          <Button
            variant="contained"
            onClick={() => submit.mutate()}
            disabled={!canSubmit || submit.isPending}
          >
            {copy.submit}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
