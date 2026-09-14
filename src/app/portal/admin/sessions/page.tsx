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
import UploadFileIcon from "@mui/icons-material/UploadFile";
import type { ParticipationRecord, Profile, SessionLog, SessionType } from "@/types/portal";
import {
  createParticipation,
  deleteParticipation,
  deleteSession,
  listCohorts,
  listMatches,
  listParticipation,
  listProfiles,
  listSessions,
  logSession,
  updateSession,
} from "@/lib/portal/store";
import {
  getParticipationSignedUrl,
  IMAGE_ACCEPT,
  PARTICIPATION_MAX_BYTES,
  removeParticipationScreenshot,
  uploadParticipationScreenshot,
  validateImageFile,
} from "@/lib/portal/uploads";
import { sessionTypeColors, sessionTypeLabels } from "@/data/portalCopy";
import { usePortalSession } from "@/components/portal/PortalSessionProvider";

const today = () => new Date().toISOString().slice(0, 10);

const sessionTypes: SessionType[] = ["mentorship", "gratitude"];

export default function ProgressPage() {
  const { currentUser } = usePortalSession();
  const role = currentUser?.is_admin
    ? "admin"
    : currentUser?.participant_role;

  const { data: cohorts } = useQuery({ queryKey: ["portal", "cohorts"], queryFn: listCohorts });

  // Non-admins are limited to their own cohorts.
  const availableCohorts = React.useMemo(() => {
    const all = cohorts ?? [];
    if (role === "admin") return all;
    return all.filter((c) => currentUser?.cohort_ids.includes(c.id));
  }, [cohorts, role, currentUser]);

  const [cohortId, setCohortId] = React.useState("");
  React.useEffect(() => {
    if (!cohortId && availableCohorts.length) setCohortId(availableCohorts[0].id);
  }, [availableCohorts, cohortId]);

  if (!currentUser) {
    return <Typography color="text.secondary">加载中…</Typography>;
  }
  if (!role) {
    return <Alert severity="error">你的身份只能查看资料，无法管理进度记录。</Alert>;
  }

  return (
    <Box sx={{ maxWidth: 1000 }}>
      <Typography variant="h4" fontWeight={800} gutterBottom>
        进度跟踪
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {role === "mentee"
          ? "查看你参与的交流记录，并提交你的活动参与记录。"
          : role === "mentor"
            ? "记录你与学员完成的交流，查看你的交流进度。"
            : "记录已完成的交流场次，管理师友的交流进度。"}
      </Typography>

      <TextField
        select
        size="small"
        label="项目"
        value={cohortId}
        onChange={(e) => setCohortId(e.target.value)}
        sx={{ mb: 3, minWidth: 240 }}
      >
        {availableCohorts.map((c) => (
          <MenuItem key={c.id} value={c.id}>
            {c.name}
          </MenuItem>
        ))}
      </TextField>

      {cohortId &&
        (role === "mentee" ? (
          <MenteeView cohortId={cohortId} currentUser={currentUser!} />
        ) : (
          <StaffView cohortId={cohortId} role={role} currentUser={currentUser!} />
        ))}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Mentee view: own session history (read-only) + participation submission.
// ---------------------------------------------------------------------------

function MenteeView({
  cohortId,
  currentUser,
}: {
  cohortId: string;
  currentUser: Profile;
}) {
  const queryClient = useQueryClient();

  const { data: sessions } = useQuery({
    queryKey: ["portal", "sessions", cohortId, "mentee", currentUser.id],
    queryFn: () => listSessions({ cohortId, menteeId: currentUser.id }),
    enabled: Boolean(cohortId),
  });

  const { data: profiles } = useQuery({
    queryKey: ["portal", "profiles"],
    queryFn: () => listProfiles(),
  });
  const nameOf = (id: string) => profiles?.find((p) => p.id === id)?.full_name ?? "未知";

  const { data: records } = useQuery({
    queryKey: ["portal", "participation", cohortId, currentUser.id],
    queryFn: () => listParticipation({ cohortId, menteeId: currentUser.id }),
    enabled: Boolean(cohortId),
  });

  const [eventName, setEventName] = React.useState("");
  const [screenshot, setScreenshot] = React.useState<File | null>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["portal", "participation"] });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const screenshotPath = screenshot
        ? await uploadParticipationScreenshot(currentUser.id, screenshot)
        : null;
      try {
        return await createParticipation({
          cohort_id: cohortId,
          mentee_id: currentUser.id,
          event_name: eventName.trim(),
          screenshot_name: screenshot?.name ?? null,
          screenshot_path: screenshotPath,
        });
      } catch (error) {
        if (screenshotPath) {
          await removeParticipationScreenshot(screenshotPath).catch(() => {});
        }
        throw error;
      }
    },
    onSuccess: () => {
      setEventName("");
      setScreenshot(null);
      setFileError(null);
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteParticipation(id),
    onSuccess: invalidate,
  });

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    const validationError = validateImageFile(file, PARTICIPATION_MAX_BYTES);
    if (validationError) {
      setScreenshot(null);
      setFileError(validationError);
      return;
    }
    setFileError(null);
    setScreenshot(file);
  };

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, md: 6 }}>
        <Paper sx={{ p: 3, borderRadius: 3 }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            我的交流记录（{sessions?.length ?? 0}）
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            由导师或管理员录入，展示你参与的所有交流场次。
          </Typography>
          {sessions && sessions.length > 0 ? (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>日期</TableCell>
                  <TableCell>导师</TableCell>
                  <TableCell>类型</TableCell>
                  <TableCell>备注</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sessions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.session_date}</TableCell>
                    <TableCell>{nameOf(s.mentor_id)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        variant="outlined"
                        color={sessionTypeColors[s.session_type]}
                        label={sessionTypeLabels[s.session_type]}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" title={s.notes ?? ""}>
                        {s.notes ?? "—"}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Alert severity="info">暂时还没有交流记录。</Alert>
          )}
        </Paper>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <Paper sx={{ p: 3, borderRadius: 3 }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            提交活动记录
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            填写你参与的活动名称，并上传截图作为参与证明。
          </Typography>
          <Stack spacing={2}>
            {(fileError || submitMutation.isError) && (
              <Alert severity="error">
                {fileError ??
                  (submitMutation.error instanceof Error
                    ? submitMutation.error.message
                    : "活动记录提交失败。")}
              </Alert>
            )}
            <TextField
              label="活动名称"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              fullWidth
            />
            <Button
              component="label"
              variant="outlined"
              startIcon={<UploadFileIcon />}
            >
              {screenshot ? "重新选择截图" : "上传截图"}
              <input
                type="file"
                accept={IMAGE_ACCEPT}
                hidden
                onChange={(e) => {
                  handleFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </Button>
            <Typography variant="caption" color="text.secondary">
              JPEG、PNG 或 WebP，最大 5 MB
            </Typography>
            {screenshot && (
              <Typography variant="caption" color="text.secondary">
                已选择：{screenshot.name}
              </Typography>
            )}
            <Box>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<AddIcon />}
                disabled={!eventName.trim() || submitMutation.isPending}
                onClick={() => submitMutation.mutate()}
              >
                提交记录
              </Button>
            </Box>
          </Stack>

          <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 3, mb: 1 }}>
            已提交的活动记录（{records?.length ?? 0}）
          </Typography>
          {records && records.length > 0 ? (
            <Stack spacing={1.5}>
              {records.map((r) => (
                <ParticipationRow
                  key={r.id}
                  record={r}
                  onDelete={() => deleteMutation.mutate(r.id)}
                />
              ))}
            </Stack>
          ) : (
            <Alert severity="info">还没有提交任何活动记录。</Alert>
          )}
        </Paper>
      </Grid>
    </Grid>
  );
}

function ParticipationRow({
  record,
  onDelete,
}: {
  record: ParticipationRecord;
  onDelete: () => void;
}) {
  const { data: signedUrl } = useQuery({
    queryKey: ["portal", "participation-signed-url", record.screenshot_path],
    queryFn: () => getParticipationSignedUrl(record.screenshot_path!),
    enabled: Boolean(record.screenshot_path),
    staleTime: 50 * 60 * 1000,
  });
  const screenshotUrl = signedUrl ?? record.screenshot_url;

  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        {screenshotUrl ? (
          <Box
            component="img"
            src={screenshotUrl}
            alt={record.event_name}
            sx={{ width: 48, height: 48, objectFit: "cover", borderRadius: 1 }}
          />
        ) : (
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 1,
              bgcolor: "action.hover",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <UploadFileIcon fontSize="small" color="disabled" />
          </Box>
        )}
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography fontWeight={600} noWrap>
            {record.event_name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {new Date(record.created_at).toLocaleDateString("zh-CN")}
            {record.screenshot_name ? ` · ${record.screenshot_name}` : "（无截图）"}
          </Typography>
        </Box>
        <Tooltip title="删除">
          <IconButton size="small" onClick={onDelete}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
    </Paper>
  );
}

// ---------------------------------------------------------------------------
// Admin / mentor view: log sessions + stats + recent sessions table.
// ---------------------------------------------------------------------------

function StaffView({
  cohortId,
  role,
  currentUser,
}: {
  cohortId: string;
  role: "admin" | "mentor";
  currentUser: Profile;
}) {
  const queryClient = useQueryClient();
  const isMentor = role === "mentor";

  const [mentorId, setMentorId] = React.useState(isMentor ? currentUser.id : "");
  const [menteeId, setMenteeId] = React.useState("");
  const [sessionType, setSessionType] = React.useState<SessionType>("mentorship");
  const [date, setDate] = React.useState(today());
  const [notes, setNotes] = React.useState("");
  const [editing, setEditing] = React.useState<SessionLog | null>(null);

  React.useEffect(() => {
    if (isMentor) setMentorId(currentUser.id);
  }, [isMentor, currentUser]);

  const { data: profiles } = useQuery({
    queryKey: ["portal", "profiles"],
    queryFn: () => listProfiles(),
  });

  const { data: sessions } = useQuery({
    queryKey: ["portal", "sessions", cohortId, isMentor ? currentUser.id : "all"],
    queryFn: () =>
      listSessions(isMentor ? { cohortId, mentorId: currentUser.id } : { cohortId }),
    enabled: Boolean(cohortId),
  });

  const { data: matches } = useQuery({
    queryKey: ["portal", "matches", cohortId],
    queryFn: () => listMatches({ cohortId }),
    enabled: Boolean(cohortId),
  });

  const mentors = (profiles ?? []).filter(
    (p) => p.participant_role === "mentor" && p.cohort_ids.includes(cohortId),
  );
  const allMentees = (profiles ?? []).filter(
    (p) => p.participant_role === "mentee" && p.cohort_ids.includes(cohortId),
  );
  // Mentors may only log records for their matched mentees; admins see everyone.
  const matchedMenteeIds = React.useMemo(
    () =>
      new Set(
        (matches ?? [])
          .filter((m) => (isMentor ? m.mentor_id === currentUser.id : true))
          .map((m) => m.mentee_id),
      ),
    [matches, isMentor, currentUser.id],
  );
  const mentees = isMentor
    ? allMentees.filter((m) => matchedMenteeIds.has(m.id))
    : allMentees;
  // A mentor with no uploaded matches cannot submit any records yet.
  const mentorBlocked = isMentor && mentees.length === 0;
  const nameOf = (id: string) => profiles?.find((p) => p.id === id)?.full_name ?? "未知";

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
        session_type: sessionType,
        session_date: date,
        notes: notes.trim() || null,
        created_by: currentUser.id,
      }),
    onSuccess: () => {
      if (!isMentor) setMentorId("");
      setMenteeId("");
      setSessionType("mentorship");
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
        session_type: s.session_type,
        session_date: s.session_date,
        notes: s.notes,
      }),
    onSuccess: () => {
      setEditing(null);
      invalidate();
    },
  });

  const canSubmit = mentorId && menteeId && date && !mentorBlocked;

  return (
    <>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              活动纪录
            </Typography>
            {mentorBlocked && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                管理员尚未上传本项目的配对结果，暂时无法记录交流。
              </Alert>
            )}
            <Stack spacing={2}>
              <TextField
                select
                label="导师"
                value={mentorId}
                onChange={(e) => setMentorId(e.target.value)}
                fullWidth
                disabled={isMentor}
                helperText={isMentor ? "导师只能记录自己的辅导场次" : undefined}
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
                disabled={mentorBlocked}
                helperText={isMentor ? "仅显示与你配对的学员" : undefined}
              >
                {mentees.map((m) => (
                  <MenuItem key={m.id} value={m.id}>
                    {m.full_name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="类型"
                value={sessionType}
                onChange={(e) => setSessionType(e.target.value as SessionType)}
                fullWidth
              >
                {sessionTypes.map((t) => (
                  <MenuItem key={t} value={t}>
                    {sessionTypeLabels[t]}
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
        </Grid>

        <Grid size={{ xs: 12, md: 7 }}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              最近的交流记录（{sessions?.length ?? 0}）
            </Typography>
            {sessions && sessions.length > 0 ? (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>日期</TableCell>
                    <TableCell>导师</TableCell>
                    <TableCell>学员</TableCell>
                    <TableCell>类型</TableCell>
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
                      <TableCell>
                        <Chip
                          size="small"
                          variant="outlined"
                          color={sessionTypeColors[s.session_type]}
                          label={sessionTypeLabels[s.session_type]}
                        />
                      </TableCell>
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
              <Alert severity="info">还没有任何交流记录。</Alert>
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
    </>
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
      <DialogTitle>编辑交流记录</DialogTitle>
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
              select
              label="类型"
              value={draft.session_type}
              onChange={(e) =>
                setDraft({ ...draft, session_type: e.target.value as SessionType })
              }
              fullWidth
            >
              {sessionTypes.map((t) => (
                <MenuItem key={t} value={t}>
                  {sessionTypeLabels[t]}
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
