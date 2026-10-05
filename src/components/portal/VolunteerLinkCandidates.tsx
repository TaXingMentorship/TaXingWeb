"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import LinkIcon from "@mui/icons-material/Link";
import PersonOffIcon from "@mui/icons-material/PersonOff";
import Collapse from "@mui/material/Collapse";
import {
  linkVolunteerProfile,
  listLinkCandidates,
  setLinkRejected,
  type LinkCandidate,
} from "@/lib/portal/store";
import { portalCopy } from "@/data/portalCopy";

/**
 * Volunteers who share a name with a portal account but were not linked
 * automatically, because their emails differ or one side has none.
 *
 * The import refuses to merge two records on a name alone (NAME_MISMATCH), and
 * the linking triggers hold the same line. Same name is a lead, not proof — so
 * this list exists to put the judgement in front of a person.
 */
export default function VolunteerLinkCandidates() {
  const copy = portalCopy.adminVolunteers;
  const queryClient = useQueryClient();
  type Pending = {
    kind: "link" | "reject";
    volunteerId: string;
    volunteerName: string;
    profileId: string;
    profileName: string;
  };
  const [pending, setPending] = React.useState<Pending | null>(null);
  const [showRejected, setShowRejected] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["portal", "volunteerLinkCandidates"],
    queryFn: listLinkCandidates,
  });
  const candidates = data?.pending ?? [];
  const rejected = data?.rejected ?? [];

  const refreshCandidates = () =>
    queryClient.invalidateQueries({
      queryKey: ["portal", "volunteerLinkCandidates"],
    });

  const rejectMutation = useMutation({
    mutationFn: ({
      volunteerId,
      profileId,
      rejected: value,
    }: {
      volunteerId: string;
      profileId: string;
      rejected: boolean;
    }) => setLinkRejected(volunteerId, profileId, value),
    onSuccess: () => {
      setPending(null);
      refreshCandidates();
    },
  });

  const linkMutation = useMutation({
    mutationFn: ({ id, profileId }: { id: string; profileId: string }) =>
      linkVolunteerProfile(id, profileId),
    onSuccess: () => {
      setPending(null);
      queryClient.invalidateQueries({ queryKey: ["portal", "volunteers"] });
      refreshCandidates();
    },
  });

  return (
    <Box component="section">
      <Typography variant="h5" fontWeight={800} gutterBottom>
        {copy.matchesTitle}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {copy.matchesIntro}
      </Typography>

      {isLoading ? (
        <Typography color="text.secondary">{portalCopy.volunteers.loading}</Typography>
      ) : candidates.length === 0 ? (
        <Alert severity="success">{copy.matchesEmpty}</Alert>
      ) : (
        <Paper sx={{ borderRadius: 3, overflow: "hidden" }}>
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{copy.matchVolunteer}</TableCell>
                  <TableCell>{copy.matchProfile}</TableCell>
                  <TableCell align="right">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {candidates.map(({ volunteer, profile }) => (
                  <TableRow key={volunteer.id} hover>
                    <TableCell sx={{ minWidth: 160 }}>
                      <Typography variant="body2" fontWeight={600}>
                        {volunteer.full_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {volunteer.email ?? "无邮箱"}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ minWidth: 200 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Avatar
                          src={profile.avatar_url ?? undefined}
                          sx={{ width: 28, height: 28, fontSize: 13 }}
                        />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600}>
                            {profile.full_name}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ wordBreak: "break-all" }}
                          >
                            {profile.email ?? "无邮箱"}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                      <Button
                        size="small"
                        color="inherit"
                        startIcon={<PersonOffIcon />}
                        sx={{ mr: 1 }}
                        onClick={() =>
                          setPending({
                            kind: "reject",
                            volunteerId: volunteer.id,
                            volunteerName: volunteer.full_name,
                            profileId: profile.id,
                            profileName: profile.full_name ?? "",
                          })
                        }
                      >
                        {copy.matchReject}
                      </Button>
                      <Button
                        size="small"
                        startIcon={<LinkIcon />}
                        onClick={() =>
                          setPending({
                            kind: "link",
                            volunteerId: volunteer.id,
                            volunteerName: volunteer.full_name,
                            profileId: profile.id,
                            profileName: profile.full_name ?? "",
                          })
                        }
                      >
                        {copy.matchConfirm}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {rejected.length > 0 ? (
        <Box sx={{ mt: 3 }}>
          <Button size="small" color="inherit" onClick={() => setShowRejected((v) => !v)}>
            {copy.rejectedTitle(rejected.length)}
          </Button>
          <Collapse in={showRejected} unmountOnExit>
            <Stack spacing={1} sx={{ mt: 1 }}>
              {rejected.map(({ volunteer, profile }: LinkCandidate) => (
                <Stack
                  key={`${volunteer.id}:${profile.id}`}
                  direction="row"
                  spacing={2}
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <Typography variant="body2" color="text.secondary">
                    {volunteer.full_name}（{volunteer.email ?? "无邮箱"}）≠{" "}
                    {profile.full_name}（{profile.email ?? "无邮箱"}）
                  </Typography>
                  <Button
                    size="small"
                    disabled={rejectMutation.isPending}
                    onClick={() =>
                      rejectMutation.mutate({
                        volunteerId: volunteer.id,
                        profileId: profile.id,
                        rejected: false,
                      })
                    }
                  >
                    {copy.rejectedUndo}
                  </Button>
                </Stack>
              ))}
            </Stack>
          </Collapse>
        </Box>
      ) : null}

      <Dialog
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {pending?.kind === "reject" ? copy.matchRejectTitle : copy.matchConfirmTitle}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {pending
              ? (pending.kind === "reject"
                  ? copy.matchRejectBody
                  : copy.matchConfirmBody)(pending.volunteerName, pending.profileName)
              : ""}
          </DialogContentText>
          {linkMutation.isError || rejectMutation.isError ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              {((linkMutation.error ?? rejectMutation.error) as Error).message}
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPending(null)}>
            {portalCopy.volunteers.cancel}
          </Button>
          <Button
            variant="contained"
            color="secondary"
            disabled={linkMutation.isPending || rejectMutation.isPending}
            onClick={() => {
              if (!pending) return;
              if (pending.kind === "reject") {
                rejectMutation.mutate({
                  volunteerId: pending.volunteerId,
                  profileId: pending.profileId,
                  rejected: true,
                });
              } else {
                linkMutation.mutate({
                  id: pending.volunteerId,
                  profileId: pending.profileId,
                });
              }
            }}
          >
            {pending?.kind === "reject" ? copy.matchReject : copy.matchConfirm}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
