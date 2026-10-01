"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import type { NameChangeRequest } from "@/types/portal";
import {
  markNameChangesSeen,
  requestNameChange,
  withdrawNameChange,
} from "@/lib/portal/store";
import { portalCopy } from "@/data/portalCopy";
import { usePortalSession } from "@/components/portal/PortalSessionProvider";
import {
  MY_NAME_CHANGES_KEY,
  useMyNameChanges,
} from "@/components/portal/useNameChanges";

/**
 * The 昵称 field on 我的资料.
 *
 * Admins edit it in place as before. Everyone else sees it read-only (the
 * database enforces the same lock, migration 0021) with a 申请修改 button, and
 * the state of their latest request underneath: waiting, approved, or rejected
 * with the admin's note. A decision is shown once and then marked seen, which
 * is what clears the dot on the sidebar item.
 */
export default function NameChangeField({
  name,
  onNameChange,
}: {
  name: string;
  onNameChange: (value: string) => void;
}) {
  const copy = portalCopy.nameChange;
  const queryClient = useQueryClient();
  // Follows the persona preview so an admin can see what a member sees. It only
  // decides what the UI shows: the database lock keys off the real account.
  const { currentUser } = usePortalSession();
  const { pending, unseen } = useMyNameChanges();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [requestedName, setRequestedName] = React.useState("");
  const [reason, setReason] = React.useState("");

  // Hold the decision on screen for this visit, then mark it seen.
  const [decision, setDecision] = React.useState<NameChangeRequest | null>(null);
  const seenMutation = useMutation({
    mutationFn: markNameChangesSeen,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: MY_NAME_CHANGES_KEY }),
  });
  const { mutate: markSeen } = seenMutation;
  React.useEffect(() => {
    if (decision || unseen.length === 0) return;
    setDecision(unseen[0]);
    markSeen();
  }, [unseen, decision, markSeen]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: MY_NAME_CHANGES_KEY });
  };

  const submit = useMutation({
    mutationFn: () =>
      requestNameChange({
        requestedName: requestedName.trim(),
        reason: reason.trim(),
      }),
    onSuccess: () => {
      setDialogOpen(false);
      setDecision(null);
      refresh();
    },
  });

  const withdraw = useMutation({
    mutationFn: withdrawNameChange,
    onSuccess: refresh,
  });

  if (currentUser?.is_admin) {
    return (
      <TextField
        label={copy.fieldLabel}
        value={name}
        onChange={(event) => onNameChange(event.target.value)}
        fullWidth
      />
    );
  }

  const openDialog = () => {
    setRequestedName("");
    setReason("");
    submit.reset();
    setDialogOpen(true);
  };

  const canSubmit = requestedName.trim() !== "" && reason.trim() !== "";

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <TextField
          label={copy.fieldLabel}
          value={name}
          fullWidth
          disabled
          helperText={copy.lockedHint}
        />
        <Button
          variant="outlined"
          onClick={openDialog}
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
              onClick={() => withdraw.mutate()}
              disabled={withdraw.isPending}
            >
              {copy.withdraw}
            </Button>
          }
        >
          {copy.pending(pending.requested_name)}
        </Alert>
      )}
      {withdraw.isError && (
        <Alert severity="error">
          {withdraw.error instanceof Error ? withdraw.error.message : "撤回失败。"}
        </Alert>
      )}

      {!pending && decision && (
        <Alert
          severity={decision.status === "approved" ? "success" : "warning"}
          onClose={() => setDecision(null)}
        >
          {decision.status === "approved"
            ? copy.approved(decision.requested_name)
            : copy.rejected(decision.requested_name, decision.review_note ?? "")}
        </Alert>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
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
              value={name}
              disabled
              fullWidth
            />
            <TextField
              label={copy.newNameLabel}
              value={requestedName}
              onChange={(event) => setRequestedName(event.target.value)}
              required
              fullWidth
              autoFocus
              inputProps={{ maxLength: 200 }}
            />
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
          <Button onClick={() => setDialogOpen(false)}>{copy.cancel}</Button>
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
