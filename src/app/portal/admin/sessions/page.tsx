"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Chip from "@mui/material/Chip";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import type { Profile, SessionLog } from "@/types/portal";
import {
  deleteSession,
  listCohorts,
  listProfiles,
  listSessions,
  logSession,
  updateSession,
} from "@/lib/portal/store";
import { usePortalSession } from "@/components/portal/PortalSessionProvider";

const today = () => new Date().toISOString().slice(0, 10);

export default function AdminSessionsPage() {
  const { currentUser } = usePortalSession();
  const queryClient = useQueryClient();

  const [cohortId, setCohortId] = React.useState("");
  const [mentorId, setMentorId] = React.useState("");
  const [menteeId, setMenteeId] = React.useState("");
  const [date, setDate] = React.useState(today());
  const [notes, setNotes] = React.useState("");
  const [editing, setEditing] = React.useState<SessionLog | null>(null);

  const { data: cohorts } = useQuery({ queryKey: ["portal", "cohorts"], queryFn: listCohorts });
  React.useEffect(() => {
    if (!cohortId && cohorts?.length) setCohortId(cohorts[0].id);
  }, [cohorts, cohortId]);

  const { data: profiles } = useQuery({
    queryKey: ["portal", "profiles"],
    queryFn: () => listProfiles(),
  });

  const { data: sessions } = useQuery({
    queryKey: ["portal", "sessions", cohortId],
    queryFn: () => listSessions({ cohortId }),
    enabled: Boolean(cohortId),
  });

  const mentors = (profiles ?? []).filter(
    (p) => p.role === "mentor" && p.cohort_ids.includes(cohortId),
  );
  const mentees = (profiles ?? []).filter(
    (p) => p.role === "mentee" && p.cohort_ids.includes(cohortId),
  );
  const nameOf = (id: string) => profiles?.find((p) => p.id === id)?.full_name ?? "未知";

  // Per-pair counts.
  const pairCounts = React.useMemo(() => {
    const map = new Map<string, { mentor: string; mentee: string; count: number }>();
    (sessions ?? []).forEach((s) => {
      const key = `${s.mentor_id}__${s.mentee_id}`;
      const cur = map.get(key) ?? { mentor: s.mentor_id, mentee: s.mentee_id, count: 0 };
      cur.count += 1;
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [sessions]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["portal", "sessions"] }).then(() =>
      queryClient.invalidateQueries({ queryKey: ["portal", "mySessions"] }),
    );

  const logMutation = useMutation({
    mutationFn: () =>
      logSession({
        cohort_id: cohortId,
        mentor_id: mentorId,
        mentee_id: menteeId,
        session_date: date,
        notes: notes.trim() || null,
        created_by: currentUser!.id,
      }),
    onSuccess: () => {
      setMentorId("");
      setMenteeId("");
      setNotes("");
      setDate(today());
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSession(id),
    onSuccess: invalidate,
  });

  const editMutation = useMutation({
    mutationFn: (s: SessionLog) =>
      updateSession(s.id, {
        mentor_id: s.mentor_id,
        mentee_id: s.mentee_id,
        session_date: s.session_date,
        notes: s.notes,
      }),
    onSuccess: () => {
      setEditing(null);
      invalidate();
    },
  });

  if (currentUser?.role !== "admin") {
    return <Alert severity="error">仅管理员可访问进度跟踪。</Alert>;
  }

  const canSubmit = mentorId && menteeId && date;

  return (
    <Box sx={{ maxWidth: 1000 }}>
      <Typography variant="h4" fontWeight={800} gutterBottom>
        进度跟踪
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        记录已完成的辅导场次，查看每对师友的进度统计。
      </Typography>

      <TextField
        select
        size="small"
        label="项目"
        value={cohortId}
        onChange={(e) => setCohortId(e.target.value)}
        sx={{ mb: 3, minWidth: 240 }}
      >
        {(cohorts ?? []).map((c) => (
          <MenuItem key={c.id} value={c.id}>
            {c.name}
          </MenuItem>
        ))}
      </TextField>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              记录一次辅导
            </Typography>
            <Stack spacing={2}>
              <TextField
                select
                label="导师"
                value={mentorId}
                onChange={(e) => setMentorId(e.target.value)}
                fullWidth
              >
                {mentors.map((m) => (
                  <MenuItem key={m.id} value={m.id}>
                    {m.full_name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="学员"
                value={menteeId}
                onChange={(e) => setMenteeId(e.target.value)}
                fullWidth
              >
                {mentees.map((m) => (
                  <MenuItem key={m.id} value={m.id}>
                    {m.full_name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="日期"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="备注"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                fullWidth
                multiline
                minRows={2}
              />
              <Button
                variant="contained"
                color="secondary"
                startIcon={<AddIcon />}
                disabled={!canSubmit || logMutation.isPending}
                onClick={() => logMutation.mutate()}
              >
                添加记录
              </Button>
            </Stack>
          </Paper>

          <Paper sx={{ p: 3, borderRadius: 3, mt: 3 }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              配对进度统计
            </Typography>
            {pairCounts.length === 0 ? (
              <Alert severity="info">还没有任何辅导记录。</Alert>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>导师</TableCell>
                    <TableCell>学员</TableCell>
                    <TableCell align="right">次数</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pairCounts.map((p) => (
                    <TableRow key={`${p.mentor}-${p.mentee}`}>
                      <TableCell>{nameOf(p.mentor)}</TableCell>
                      <TableCell>{nameOf(p.mentee)}</TableCell>
                      <TableCell align="right">
                        <Chip size="small" color="secondary" label={p.count} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 7 }}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              最近的辅导记录（{sessions?.length ?? 0}）
            </Typography>
            {sessions && sessions.length > 0 ? (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>日期</TableCell>
                    <TableCell>导师</TableCell>
                    <TableCell>学员</TableCell>
                    <TableCell>备注</TableCell>
                    <TableCell align="right">操作</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sessions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.session_date}</TableCell>
                      <TableCell>{nameOf(s.mentor_id)}</TableCell>
                      <TableCell>{nameOf(s.mentee_id)}</TableCell>
                      <TableCell sx={{ maxWidth: 200 }}>
                        <Typography variant="body2" noWrap title={s.notes ?? ""}>
                          {s.notes ?? "—"}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="编辑">
                          <IconButton size="small" onClick={() => setEditing(s)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="删除">
                          <IconButton
                            size="small"
                            onClick={() => deleteMutation.mutate(s.id)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Alert severity="info">还没有任何辅导记录。</Alert>
            )}
          </Paper>
        </Grid>
      </Grid>

      <EditSessionDialog
        session={editing}
        mentors={mentors}
        mentees={mentees}
        onClose={() => setEditing(null)}
        onSave={(s) => editMutation.mutate(s)}
        saving={editMutation.isPending}
      />
    </Box>
  );
}

function EditSessionDialog({
  session,
  mentors,
  mentees,
  onClose,
  onSave,
  saving,
}: {
  session: SessionLog | null;
  mentors: Profile[];
  mentees: Profile[];
  onClose: () => void;
  onSave: (s: SessionLog) => void;
  saving: boolean;
}) {
  const [draft, setDraft] = React.useState<SessionLog | null>(session);
  React.useEffect(() => setDraft(session), [session]);

  return (
    <Dialog open={Boolean(session)} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>编辑辅导记录</DialogTitle>
      {draft && (
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="导师"
              value={draft.mentor_id}
              onChange={(e) => setDraft({ ...draft, mentor_id: e.target.value })}
              fullWidth
            >
              {mentors.map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  {m.full_name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="学员"
              value={draft.mentee_id}
              onChange={(e) => setDraft({ ...draft, mentee_id: e.target.value })}
              fullWidth
            >
              {mentees.map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  {m.full_name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="日期"
              type="date"
              value={draft.session_date}
              onChange={(e) => setDraft({ ...draft, session_date: e.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="备注"
              value={draft.notes ?? ""}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              fullWidth
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
      )}
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button
          variant="contained"
          color="secondary"
          disabled={saving}
          onClick={() => draft && onSave(draft)}
        >
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
}
