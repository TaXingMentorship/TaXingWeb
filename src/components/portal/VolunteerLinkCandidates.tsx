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
import { linkVolunteerProfile, listLinkCandidates } from "@/lib/portal/store";
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
  const [pending, setPending] = React.useState<{
    volunteerId: string;
    volunteerName: string;
    profileId: string;
    profileName: string;
  } | null>(null);

  const { data: candidates, isLoading } = useQuery({
    queryKey: ["portal", "volunteerLinkCandidates"],
    queryFn: listLinkCandidates,
  });

  const linkMutation = useMutation({
    mutationFn: ({ id, profileId }: { id: string; profileId: string }) =>
      linkVolunteerProfile(id, profileId),
    onSuccess: () => {
      setPending(null);
      queryClient.invalidateQueries({ queryKey: ["portal", "volunteers"] });
      queryClient.invalidateQueries({
        queryKey: ["portal", "volunteerLinkCandidates"],
      });
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
      ) : (candidates ?? []).length === 0 ? (
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
                {(candidates ?? []).map(({ volunteer, profile }) => (
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
                        startIcon={<LinkIcon />}
                        onClick={() =>
                          setPending({
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

      <Dialog
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{copy.matchConfirmTitle}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {pending
              ? copy.matchConfirmBody(pending.volunteerName, pending.profileName)
              : ""}
          </DialogContentText>
          {linkMutation.isError ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              {(linkMutation.error as Error).message}
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
            disabled={linkMutation.isPending}
            onClick={() => {
              if (pending) {
                linkMutation.mutate({
                  id: pending.volunteerId,
                  profileId: pending.profileId,
                });
              }
            }}
          >
            {copy.matchConfirm}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
