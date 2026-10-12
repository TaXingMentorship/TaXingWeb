"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import type { MentorGroupChangeRequest } from "@/types/portal";
import {
  listCohorts,
  listMentorGroups,
  listProfiles,
  reviewMentorGroupChange,
} from "@/lib/portal/store";
import { portalCopy } from "@/data/portalCopy";
import {
  PENDING_GROUP_CHANGES_KEY,
  usePendingMentorGroupChanges,
} from "@/components/portal/useMentorGroupChanges";

/**
 * Pending answer-group requests, shown at the top of 成员名单 and only while
 * there are any. Approving moves the mentor; rejecting needs a note, which the
 * requester sees.
 */
export default function MentorGroupChangeReviewCard() {
  const copy = portalCopy.mentorGroupChange;
  const queryClient = useQueryClient();
  const { requests } = usePendingMentorGroupChanges();

  const { data: profiles } = useQuery({
    queryKey: ["portal", "profiles"],
    queryFn: () => listProfiles(),
    enabled: requests.length > 0,
  });
  const { data: groups } = useQuery({
    queryKey: ["portal", "mentorGroups", "all"],
    queryFn: () => listMentorGroups(),
    enabled: requests.length > 0,
  });
  const { data: cohorts } = useQuery({
    queryKey: ["portal", "cohorts"],
    queryFn: listCohorts,
    enabled: requests.length > 0,
  });

  const [rejecting, setRejecting] = React.useState<MentorGroupChangeRequest | null>(null);
  const [note, setNote] = React.useState("");

  const review = useMutation({
    mutationFn: reviewMentorGroupChange,
    onSuccess: () => {
      setRejecting(null);
      queryClient.invalidateQueries({ queryKey: PENDING_GROUP_CHANGES_KEY });
      // An approval changes who sits in a group.
      queryClient.invalidateQueries({ queryKey: ["portal", "mentorGroupMembers"] });
    },
  });

  if (requests.length === 0) return null;

  const nameOf = (id: string) => profiles?.find((p) => p.id === id)?.full_name ?? "—";
  const groupOf = (id: string | null) =>
    (id && groups?.find((g) => g.id === id)?.name) || copy.unassigned;
  const seasonOf = (id: string) => cohorts?.find((c) => c.id === id)?.name ?? "";
  const rowText = (r: MentorGroupChangeRequest) =>
    copy.reviewRow(nameOf(r.profile_id), seasonOf(r.cohort_id), groupOf(r.from_group_id), groupOf(r.to_group_id));

  const openReject = (request: MentorGroupChangeRequest) => {
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

      <Stack
        spacing={1.5}
        divider={<hr style={{ width: "100%", border: 0, borderTop: "1px solid rgba(128,128,128,.25)" }} />}
      >
        {requests.map((request) => (
          <Stack
            key={request.id}
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems={{ sm: "center" }}
            justifyContent="space-between"
          >
            <div>
              <Typography fontWeight={600}>{rowText(request)}</Typography>
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

      <Dialog open={Boolean(rejecting)} onClose={() => setRejecting(null)} fullWidth maxWidth="xs">
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
                {rowText(rejecting)}
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
          <Button onClick={() => setRejecting(null)}>{copy.cancel}</Button>
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
