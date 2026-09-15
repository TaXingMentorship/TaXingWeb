"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import DialogContentText from "@mui/material/DialogContentText";
import LinearProgress from "@mui/material/LinearProgress";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutline";
import type {
  ResolvedVolunteerWithSeasons,
  TaskWithAssignments,
} from "@/types/portal";
import {
  deleteTask,
  listCohorts,
  listTasksWithAssignments,
  listVolunteerGroups,
  listVolunteers,
} from "@/lib/portal/store";
import { portalCopy } from "@/data/portalCopy";
import { usePortalSession } from "@/components/portal/PortalSessionProvider";
import TaskDialog from "@/components/portal/TaskDialog";

const TASKS_KEY = ["portal", "tasks", "admin"] as const;

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("zh-CN");
}

export default function AdminTasksPage() {
  const copy = portalCopy.adminTasks;
  const { currentUser } = usePortalSession();
  const queryClient = useQueryClient();
  const isAdmin = currentUser?.is_admin ?? false;

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [detail, setDetail] = React.useState<TaskWithAssignments | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<TaskWithAssignments | null>(null);

  const { data: tasks, isLoading } = useQuery({
    queryKey: TASKS_KEY,
    queryFn: listTasksWithAssignments,
    enabled: isAdmin,
  });
  const { data: volunteers } = useQuery({
    queryKey: ["portal", "volunteers"],
    queryFn: listVolunteers,
    enabled: isAdmin,
  });
  const { data: cohorts } = useQuery({
    queryKey: ["portal", "cohorts"],
    queryFn: listCohorts,
    enabled: isAdmin,
  });
  const { data: groups } = useQuery({
    queryKey: ["portal", "volunteerGroups"],
    queryFn: listVolunteerGroups,
    enabled: isAdmin,
  });

  const volunteerById = React.useMemo(
    () => new Map((volunteers ?? []).map((volunteer) => [volunteer.id, volunteer])),
    [volunteers],
  );

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: () => {
      setPendingDelete(null);
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
    },
  });

  if (!isAdmin) {
    return <Alert severity="error">{copy.adminOnly}</Alert>;
  }

  // "No account" is decided from the volunteer record, not the assignment —
  // once the person activates, the link appears and the count drops by itself.
  const withoutAccount = (task: TaskWithAssignments) =>
    task.assignments.filter((assignment) => {
      if (assignment.profile_id) return false;
      const volunteer = assignment.volunteer_id
        ? volunteerById.get(assignment.volunteer_id)
        : undefined;
      return !volunteer?.profile_id;
    }).length;

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h4" fontWeight={800} gutterBottom>
            {copy.title}
          </Typography>
          <Typography color="text.secondary">{copy.subtitle}</Typography>
        </Box>
        <Button
          variant="contained"
          color="secondary"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
          disabled={!volunteers || !cohorts || !groups}
        >
          {copy.newButton}
        </Button>
      </Stack>

      {deleteMutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {(deleteMutation.error as Error).message}
        </Alert>
      )}

      <Paper sx={{ borderRadius: 3, overflow: "hidden" }}>
        {isLoading ? (
          <Typography color="text.secondary" sx={{ p: 3 }}>
            {copy.loading}
          </Typography>
        ) : !tasks || tasks.length === 0 ? (
          <Typography color="text.secondary" sx={{ p: 3 }}>
            {copy.empty}
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{copy.columns.title}</TableCell>
                  <TableCell>{copy.columns.recipients}</TableCell>
                  <TableCell sx={{ minWidth: 180 }}>{copy.columns.progress}</TableCell>
                  <TableCell>{copy.columns.due}</TableCell>
                  <TableCell>{copy.columns.created}</TableCell>
                  <TableCell align="right">{copy.columns.actions}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tasks.map((task) => {
                  const total = task.assignments.length;
                  const done = task.assignments.filter((a) => a.completed_at).length;
                  const missing = withoutAccount(task);
                  return (
                    <TableRow key={task.id} hover>
                      <TableCell>
                        <Typography fontWeight={600}>{task.title}</Typography>
                        {task.link && (
                          <Typography variant="caption" color="text.secondary">
                            {task.link}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
                          <span>{total}</span>
                          {missing > 0 && (
                            <Chip size="small" color="warning" label={copy.noAccount(missing)} />
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ mb: 0.5 }}>
                          {copy.progress(done, total)}
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          color="secondary"
                          value={total === 0 ? 0 : (done / total) * 100}
                          sx={{ borderRadius: 1 }}
                        />
                      </TableCell>
                      <TableCell>{task.due_on ? formatDate(task.due_on) : copy.noDue}</TableCell>
                      <TableCell>{formatDate(task.created_at)}</TableCell>
                      <TableCell align="right">
                        <Tooltip title={copy.detailTitle}>
                          <IconButton
                            size="small"
                            aria-label={`${copy.detailTitle}：${task.title}`}
                            onClick={() => setDetail(task)}
                          >
                            <PeopleOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={copy.deleteButton}>
                          <IconButton
                            size="small"
                            color="error"
                            aria-label={`${copy.deleteButton}：${task.title}`}
                            onClick={() => setPendingDelete(task)}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <TaskDialog
        open={dialogOpen}
        volunteers={volunteers ?? []}
        cohorts={cohorts ?? []}
        groups={groups ?? []}
        onClose={() => setDialogOpen(false)}
        onSaved={() => {
          setDialogOpen(false);
          queryClient.invalidateQueries({ queryKey: TASKS_KEY });
        }}
      />

      <RecipientsDialog
        task={detail}
        volunteerById={volunteerById}
        onClose={() => setDetail(null)}
      />

      <Dialog open={Boolean(pendingDelete)} onClose={() => setPendingDelete(null)}>
        <DialogTitle>{copy.deleteTitle}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {pendingDelete ? copy.deleteConfirm(pendingDelete.title) : ""}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDelete(null)}>{copy.cancel}</Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleteMutation.isPending}
            onClick={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
          >
            {copy.deleteAction}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

/** Who has done what, one row per recipient. */
function RecipientsDialog({
  task,
  volunteerById,
  onClose,
}: {
  task: TaskWithAssignments | null;
  volunteerById: Map<string, ResolvedVolunteerWithSeasons>;
  onClose: () => void;
}) {
  const copy = portalCopy.adminTasks;
  if (!task) return null;

  const rows = task.assignments
    .map((assignment) => {
      const volunteer = assignment.volunteer_id
        ? volunteerById.get(assignment.volunteer_id)
        : undefined;
      const hasAccount = Boolean(assignment.profile_id || volunteer?.profile_id);
      return {
        id: assignment.id,
        name: volunteer?.full_name ?? "—",
        completedAt: assignment.completed_at,
        hasAccount,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        {copy.detailTitle} · {task.title}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.25}>
          {rows.map((row) => (
            <Stack
              key={row.id}
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              spacing={2}
            >
              <Typography variant="body2" fontWeight={600}>
                {row.name}
              </Typography>
              {row.completedAt ? (
                <Chip size="small" color="success" label={`${copy.statusDone} · ${formatDate(row.completedAt)}`} />
              ) : row.hasAccount ? (
                <Chip size="small" label={copy.statusPending} />
              ) : (
                <Tooltip title={copy.statusNoAccountHint}>
                  <Chip size="small" color="warning" label={copy.statusNoAccount} />
                </Tooltip>
              )}
            </Stack>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{copy.cancel}</Button>
      </DialogActions>
    </Dialog>
  );
}
