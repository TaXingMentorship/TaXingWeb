"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Alert from "@mui/material/Alert";
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
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import type { VolunteerGroup } from "@/types/portal";
import {
  deleteVolunteerGroup,
  listVolunteerGroups,
  listVolunteers,
} from "@/lib/portal/store";
import { portalCopy } from "@/data/portalCopy";
import VolunteerGroupDialog from "@/components/portal/VolunteerGroupDialog";

export default function VolunteerGroupsSection() {
  const copy = portalCopy.adminVolunteers;
  const queryClient = useQueryClient();

  const [editing, setEditing] = React.useState<VolunteerGroup | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<VolunteerGroup | null>(
    null,
  );

  const { data: groups, isLoading } = useQuery({
    queryKey: ["portal", "volunteerGroups"],
    queryFn: listVolunteerGroups,
  });
  const { data: volunteers } = useQuery({
    queryKey: ["portal", "volunteers"],
    queryFn: listVolunteers,
  });

  // Season records per group — how much a rename or deletion touches.
  const membershipCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const volunteer of volunteers ?? []) {
      for (const season of volunteer.seasons) {
        if (!season.group_id) continue;
        counts.set(season.group_id, (counts.get(season.group_id) ?? 0) + 1);
      }
    }
    return counts;
  }, [volunteers]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVolunteerGroup(id),
    onSuccess: () => {
      setPendingDelete(null);
      queryClient.invalidateQueries({ queryKey: ["portal", "volunteerGroups"] });
      queryClient.invalidateQueries({ queryKey: ["portal", "volunteers"] });
    },
  });

  const nextSortOrder =
    (groups ?? []).reduce((max, group) => Math.max(max, group.sort_order), 0) + 10;

  return (
    <Box component="section">
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ sm: "center" }}
        spacing={2}
        sx={{ mb: 1 }}
      >
        <Typography variant="h5" fontWeight={800}>
          {copy.groupsTitle}
        </Typography>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          {copy.addGroup}
        </Button>
      </Stack>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {copy.groupsIntro}
      </Typography>

      {isLoading ? (
        <Typography color="text.secondary">{portalCopy.volunteers.loading}</Typography>
      ) : (groups ?? []).length === 0 ? (
        <Alert severity="info">{copy.groupsEmpty}</Alert>
      ) : (
        <Paper sx={{ borderRadius: 3, overflow: "hidden" }}>
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>组别</TableCell>
                  <TableCell>简介</TableCell>
                  <TableCell align="right">排序</TableCell>
                  <TableCell align="right">记录</TableCell>
                  <TableCell align="right">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(groups ?? []).map((group) => (
                  <TableRow key={group.id} hover>
                    <TableCell sx={{ fontWeight: 600, minWidth: 90 }}>
                      {group.name}
                    </TableCell>
                    <TableCell
                      sx={{
                        color: "text.secondary",
                        maxWidth: 380,
                        wordBreak: "break-word",
                      }}
                    >
                      {group.description ?? "—"}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>
                      {group.sort_order}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>
                      {copy.groupMembers(membershipCounts.get(group.id) ?? 0)}
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                      <IconButton
                        size="small"
                        aria-label={`${copy.editGroupTitle}：${group.name}`}
                        onClick={() => {
                          setEditing(group);
                          setDialogOpen(true);
                        }}
                      >
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        aria-label={`${copy.deleteGroupTitle}：${group.name}`}
                        onClick={() => setPendingDelete(group)}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      <VolunteerGroupDialog
        open={dialogOpen}
        group={editing}
        nextSortOrder={nextSortOrder}
        onClose={() => setDialogOpen(false)}
        onSaved={() => {
          setDialogOpen(false);
          queryClient.invalidateQueries({ queryKey: ["portal", "volunteerGroups"] });
        }}
      />

      <Dialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{copy.deleteGroupTitle}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {pendingDelete ? copy.deleteGroupConfirm(pendingDelete.name) : ""}
          </DialogContentText>
          {deleteMutation.isError ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              {(deleteMutation.error as Error).message}
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDelete(null)}>
            {portalCopy.volunteers.cancel}
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (pendingDelete) deleteMutation.mutate(pendingDelete.id);
            }}
          >
            {portalCopy.volunteers.deleteAction}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
