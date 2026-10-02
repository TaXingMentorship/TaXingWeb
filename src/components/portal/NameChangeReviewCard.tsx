"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { NameChangeRequest } from "@/types/portal";
import { reviewNameChange } from "@/lib/portal/store";
import { portalCopy } from "@/data/portalCopy";
import { PENDING_NAME_CHANGES_KEY, usePendingNameChanges } from "@/components/portal/useNameChanges";

/**
 * Pending nickname requests, shown at the top of 成员名单 and only while there
 * are any. Approving applies the new name; rejecting needs a note, which the
 * requester sees.
 */
export default function NameChangeReviewCard() {
  const copy = portalCopy.nameChange;
  const queryClient = useQueryClient();
  const { requests } = usePendingNameChanges();

  const [rejecting, setRejecting] = React.useState<NameChangeRequest | null>(null);
  const [note, setNote] = React.useState("");

  const review = useMutation({
    mutationFn: reviewNameChange,
    onSuccess: () => {
      setRejecting(null);
      queryClient.invalidateQueries({ queryKey: PENDING_NAME_CHANGES_KEY });
      // An approval changes a name the roster and directory already show.
      queryClient.invalidateQueries({ queryKey: ["portal", "profiles"] });
    },
  });

  if (requests.length === 0) return null;

  const openReject = (request: NameChangeRequest) => {
    setNote("");
    review.reset();
    setRejecting(request);
  };

  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, p: 2, mb: 3 }}>
      <Typography fontWeight={700} sx={{ mb: 1.5 }}>
        {copy.reviewTitle}（{requests.length}）
      </Typography>

      {review.isError && !rejecting && (
        <Alert severity="error" sx={{ mb: 1.5 }}>
          {review.error instanceof Error ? review.error.message : "操作失败。"}
        </Alert>
      )}

      <Stack spacing={1.5} divider={<hr style={{ width: "100%", border: 0, borderTop: "1px solid rgba(128,128,128,.25)" }} />}>
        {requests.map((request) => (
          <Stack
            key={request.id}
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems={{ sm: "center" }}
            justifyContent="space-between"
          >
            <div>
              <Typography fontWeight={600}>
                {copy.reviewRow(request.old_name, request.requested_name)}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
              >
                {copy.reasonPrefix}
                {request.reason}
              </Typography>
            </div>
            <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
              <Button
                variant="contained"
                size="small"
                disabled={review.isPending}
                onClick={() => review.mutate({ id: request.id, approve: true })}
              >
                {copy.approve}
              </Button>
              <Button
                variant="outlined"
                color="error"
                size="small"
                disabled={review.isPending}
                onClick={() => openReject(request)}
              >
                {copy.reject}
              </Button>
            </Stack>
          </Stack>
        ))}
      </Stack>

      <Dialog
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>{copy.rejectDialogTitle}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {review.isError && (
              <Alert severity="error">
                {review.error instanceof Error ? review.error.message : "操作失败。"}
              </Alert>
            )}
            {rejecting && (
              <Typography variant="body2" color="text.secondary">
                {copy.reviewRow(rejecting.old_name, rejecting.requested_name)}
              </Typography>
            )}
            <TextField
              label={copy.rejectNoteLabel}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              required
              autoFocus
              fullWidth
              multiline
              minRows={2}
              helperText={copy.rejectNoteHint}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejecting(null)}>{portalCopy.nameChange.cancel}</Button>
          <Button
            variant="contained"
            color="error"
            disabled={note.trim() === "" || review.isPending}
            onClick={() =>
              rejecting &&
              review.mutate({ id: rejecting.id, approve: false, note: note.trim() })
            }
          >
            {copy.confirmReject}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
