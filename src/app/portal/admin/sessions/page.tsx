"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import PersonAutocomplete from "@/components/portal/PersonAutocomplete";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import Table from "@mui/material/Table";
import TableContainer from "@mui/material/TableContainer";
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
import { keyframes } from "@mui/material/styles";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import type {
  ParticipationRecord,
  Profile,
  RosterInvite,
  SessionLog,
  SessionRosterInvite,
  SessionType,
} from "@/types/portal";
import {
  canManageSeasonProgress,
  createParticipation,
  deleteParticipation,
  deleteSession,
  listCohorts,
  listMatches,
  listParticipation,
  listProfiles,
  listRosterCohorts,
  listRosterInvites,
  listSessionRosterInvites,
  listStaffRoster,
  listSessions,
  logSession,
  managerDeleteParticipation,
  managerUpdateParticipation,
  updateOwnParticipation,
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
import { portalCopy, sessionTypeColors, sessionTypeLabels } from "@/data/portalCopy";
import {
  FilterRow,
  FilterSearch,
  FilterSelect,
  TablePager,
  usePagination,
} from "@/components/portal/TableFilters";
import { usePortalSession } from "@/components/portal/PortalSessionProvider";

const today = () => new Date().toISOString().slice(0, 10);

const sessionTypes: SessionType[] = ["mentorship", "gratitude"];
const filterCopy = portalCopy.progressFilters;

type Period = "all" | "7" | "30" | "90";

/** Is an ISO date / timestamp within the last N days (inclusive)? */
function withinPeriod(value: string, period: Period): boolean {
  if (period === "all") return true;
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  // "近 7 天" = today and the 6 days before it.
  cutoff.setDate(cutoff.getDate() - (Number(period) - 1));
  return new Date(value.length === 10 ? `${value}T00:00:00` : value) >= cutoff;
}

const matchesSearch = (query: string, fields: (string | null | undefined)[]) => {
  const q = query.trim().toLowerCase();
  return !q || fields.some((f) => f?.toLowerCase().includes(q));
};

// Keeps 编辑 / 删除 visible when the table scrolls sideways on narrow screens.
const stickyActionsSx = {
  position: "sticky",
  right: 0,
  bgcolor: "background.paper",
  zIndex: 1,
} as const;
type SessionPerson = Pick<Profile, "id" | "full_name" | "email" | "wechat_number"> & {
  statusLabel?: string;
};

export default function ProgressPage() {
  const { currentUser } = usePortalSession();
  const role = currentUser?.is_admin
    ? "admin"
    : currentUser?.is_volunteer
      ? "volunteer"
      : currentUser?.participant_role;

  const { data: cohorts } = useQuery({
    queryKey: ["portal", "cohorts", role],
    queryFn: () => (role === "volunteer" ? listRosterCohorts() : listCohorts()),
  });

  // Non-admins are limited to their own cohorts.
  const availableCohorts = React.useMemo(() => {
    const all = cohorts ?? [];
    if (role === "admin" || role === "volunteer") return all;
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
    <Box sx={{ maxWidth: 1280 }}>
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
          <StaffView key={cohortId} cohortId={cohortId} role={role} currentUser={currentUser!} />
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
  const { data: rosterInvites } = useQuery({
    queryKey: ["portal", "sessionRosterInvites", cohortId, "mentee"],
    queryFn: () => listSessionRosterInvites(cohortId),
    enabled: Boolean(cohortId),
  });
  const nameOf = (id: string | null) =>
    profiles?.find((p) => p.id === id)?.full_name ??
    rosterInvites?.find((invite) => invite.id === id)?.full_name ??
    "未知";

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
  const confirmDelete = useConfirmDelete();

  const [editingRecord, setEditingRecord] = React.useState<ParticipationRecord | null>(null);
  const editMutation = useMutation({
    mutationFn: async ({ record, eventName, file }: ParticipationEdit) => {
      if (!file) {
        return updateOwnParticipation(record.id, { event_name: eventName });
      }
      const newPath = await uploadParticipationScreenshot(currentUser.id, file);
      let updated: ParticipationRecord;
      try {
        updated = await updateOwnParticipation(record.id, {
          event_name: eventName,
          screenshot_name: file.name,
          screenshot_path: newPath,
        });
      } catch (error) {
        await removeParticipationScreenshot(newPath).catch(() => {});
        throw error;
      }
      if (record.screenshot_path) {
        await removeParticipationScreenshot(record.screenshot_path).catch(() => {});
      }
      return updated;
    },
    onSuccess: () => {
      setEditingRecord(null);
      invalidate();
    },
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
            由导师或负责人录入，展示你参与的所有交流场次。
          </Typography>
          {sessions && sessions.length > 0 ? (
            <TableContainer>
              <Table size="small" sx={{ "& th, & td": { whiteSpace: "nowrap" } }}>
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
                      <TableCell>{nameOf(s.mentor_id ?? s.mentor_invite_id)}</TableCell>
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
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
                  onEdit={() => setEditingRecord(r)}
                  onDelete={() =>
                    confirmDelete.ask({
                      message: filterCopy.deleteRecord(r.event_name),
                      warning: filterCopy.deleteWarning,
                      run: () => deleteMutation.mutateAsync(r.id),
                    })
                  }
                />
              ))}
            </Stack>
          ) : (
            <Alert severity="info">还没有提交任何活动记录。</Alert>
          )}
        </Paper>
      </Grid>

      {confirmDelete.dialog}
      <EditParticipationDialog
        record={editingRecord}
        allowScreenshot
        saving={editMutation.isPending}
        error={editMutation.error}
        onClose={() => {
          setEditingRecord(null);
          editMutation.reset();
        }}
        onSave={(edit) => editMutation.mutate(edit)}
      />
    </Grid>
  );
}

function ParticipationRow({
  record,
  subtitle,
  onEdit,
  onDelete,
}: {
  record: ParticipationRecord;
  subtitle?: string;
  onEdit: () => void;
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
            {subtitle ? `${subtitle} · ` : ""}
            {new Date(record.created_at).toLocaleDateString("zh-CN")}
            {record.screenshot_name ? ` · ${record.screenshot_name}` : "（无截图）"}
          </Typography>
        </Box>
        <Tooltip title={filterCopy.edit}>
          <IconButton aria-label={filterCopy.edit} size="small" onClick={onEdit}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={filterCopy.confirmDelete}>
          <IconButton aria-label={filterCopy.confirmDelete} size="small" onClick={onDelete}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
    </Paper>
  );
}

type ParticipationEdit = {
  record: ParticipationRecord;
  eventName: string;
  file: File | null;
};

function EditParticipationDialog({
  record,
  allowScreenshot,
  saving,
  error,
  onClose,
  onSave,
}: {
  record: ParticipationRecord | null;
  allowScreenshot: boolean;
  saving: boolean;
  error: unknown;
  onClose: () => void;
  onSave: (edit: ParticipationEdit) => void;
}) {
  const [eventName, setEventName] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);
  React.useEffect(() => {
    setEventName(record?.event_name ?? "");
    setFile(null);
    setFileError(null);
  }, [record]);

  const handleFile = (next: File | undefined) => {
    if (!next) return;
    const validationError = validateImageFile(next, PARTICIPATION_MAX_BYTES);
    setFileError(validationError);
    setFile(validationError ? null : next);
  };

  return (
    <Dialog open={Boolean(record)} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{filterCopy.editRecordTitle}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {Boolean(fileError || error) && (
            <Alert severity="error">
              {fileError ?? (error instanceof Error ? error.message : filterCopy.updateRecordFailed)}
            </Alert>
          )}
          <TextField
            label={filterCopy.eventName}
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            fullWidth
          />
          {allowScreenshot && (
            <>
              <Button component="label" variant="outlined" startIcon={<UploadFileIcon />}>
                {record?.screenshot_path ? filterCopy.replaceShot : filterCopy.uploadShot}
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
                {file
                  ? filterCopy.newShot(file.name)
                  : record?.screenshot_name
                    ? filterCopy.currentShot(record.screenshot_name)
                    : filterCopy.shotHint}
              </Typography>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{filterCopy.cancel}</Button>
        <Button
          variant="contained"
          color="secondary"
          disabled={saving || !eventName.trim()}
          onClick={() =>
            record && onSave({ record, eventName: eventName.trim(), file })
          }
        >
          {filterCopy.save}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Staff / mentor view: log sessions + stats + recent sessions table.
// ---------------------------------------------------------------------------

function StaffView({
  cohortId,
  role,
  currentUser,
}: {
  cohortId: string;
  role: "admin" | "mentor" | "volunteer";
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
    queryKey: ["portal", "profiles", role === "volunteer" ? cohortId : "all"],
    queryFn: () =>
      role === "volunteer" ? listStaffRoster(cohortId) : listProfiles(),
  });

  const { data: rosterInvites } = useQuery({
    queryKey: ["portal", "sessionRosterInvites", cohortId, role],
    queryFn: () =>
      role === "admin"
        ? listRosterInvites(cohortId)
        : listSessionRosterInvites(cohortId),
    enabled: Boolean(cohortId),
  });

  const { data: sessions } = useQuery({
    queryKey: ["portal", "sessions", cohortId, isMentor ? currentUser.id : "all"],
    queryFn: () =>
      listSessions(isMentor ? { cohortId, mentorId: currentUser.id } : { cohortId }),
    enabled: Boolean(cohortId),
  });

  // Admins, group leads and 人事组 members of this season (0058).
  const { data: canManage = false } = useQuery({
    queryKey: ["portal", "canManageSeasonProgress", cohortId],
    queryFn: () => canManageSeasonProgress(cohortId),
    enabled: Boolean(cohortId),
  });
  const showActions = role !== "volunteer" || canManage;

  const { data: matches } = useQuery({
    queryKey: ["portal", "matches", cohortId],
    queryFn: () => listMatches({ cohortId }),
    enabled: Boolean(cohortId),
  });

  const matchedMentorIds = React.useMemo(
    () =>
      new Set(
        (matches ?? []).map((match) =>
          match.mentor_id ?? match.mentor_invite_id,
        ),
      ),
    [matches],
  );
  const matchedMenteeIds = React.useMemo(
    () =>
      new Set(
        (matches ?? [])
          .filter((match) => (isMentor ? match.mentor_id === currentUser.id : true))
          .map((match) => match.mentee_id ?? match.mentee_invite_id),
      ),
    [matches, isMentor, currentUser.id],
  );
  const eligibleInvites = React.useMemo(
    () =>
      (rosterInvites ?? []).filter(
        (invite: RosterInvite | SessionRosterInvite) =>
          (!("not_participating" in invite) || !invite.not_participating) &&
          (Boolean(invite.claimed_user_id) ||
            !(profiles ?? []).some(
              (profile) =>
                profile.email?.trim().toLowerCase() === invite.email.trim().toLowerCase(),
            )),
      ),
    [rosterInvites, profiles],
  );
  const inviteOptions: SessionPerson[] = eligibleInvites.map((invite) => ({
    id: invite.id,
    full_name: invite.full_name,
    email: invite.email,
    wechat_number: null,
    statusLabel: invite.claimed_user_id ? "账号已关联" : "待激活",
  }));
  const pairedInviteAccountIds = new Set(
    eligibleInvites
      .filter(
        (invite) =>
          invite.claimed_user_id &&
          (matchedMentorIds.has(invite.id) || matchedMenteeIds.has(invite.id)),
      )
      .map((invite) => invite.claimed_user_id!),
  );
  const profileOptions = (profiles ?? []).filter(
    (profile) => !pairedInviteAccountIds.has(profile.id),
  );
  const mentors: SessionPerson[] = [
    ...profileOptions.filter(
    (p) => p.participant_role === "mentor" && p.cohort_ids.includes(cohortId),
    ),
    ...inviteOptions.filter(
      (invite) =>
        eligibleInvites.some(
          (pending) => pending.id === invite.id && pending.participant_role === "mentor",
        ) &&
        (role === "admin" || role === "volunteer"
          ? matchedMentorIds.has(invite.id)
          : false),
    ),
  ];
  const allMentees: SessionPerson[] = [
    ...profileOptions.filter(
    (p) => p.participant_role === "mentee" && p.cohort_ids.includes(cohortId),
    ),
    ...inviteOptions.filter(
      (invite) =>
        eligibleInvites.some(
          (pending) => pending.id === invite.id && pending.participant_role === "mentee",
        ) &&
        (role === "admin" || role === "volunteer"
          ? matchedMenteeIds.has(invite.id)
          : matchedMenteeIds.has(invite.id)),
    ),
  ];
  const mentees = isMentor
    ? allMentees.filter((mentee) => matchedMenteeIds.has(mentee.id))
    : allMentees;
  // A mentor with no uploaded matches cannot submit any records yet.
  const mentorBlocked = isMentor && mentees.length === 0;
  const nameOf = (id: string | null) =>
    (profiles ?? []).find((profile) => profile.id === id)?.full_name ??
    eligibleInvites.find((invite) => invite.id === id)?.full_name ??
    "未知";

  const [sessionQuery, setSessionQuery] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<"all" | SessionType>("all");
  const [periodFilter, setPeriodFilter] = React.useState<Period>("all");
  const filtersActive =
    Boolean(sessionQuery.trim()) || typeFilter !== "all" || periodFilter !== "all";
  const filteredSessions = (sessions ?? []).filter(
    (s) =>
      (typeFilter === "all" || s.session_type === typeFilter) &&
      withinPeriod(s.session_date, periodFilter) &&
      matchesSearch(sessionQuery, [
        nameOf(s.mentor_id ?? s.mentor_invite_id),
        nameOf(s.mentee_id ?? s.mentee_invite_id),
        s.notes,
      ]),
  );
  const sessionPage = usePagination(
    filteredSessions.length,
    `${sessionQuery}|${typeFilter}|${periodFilter}`,
    [10, 20, 50],
  );

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
  const confirmDelete = useConfirmDelete();

  const editMutation = useMutation({
    mutationFn: (s: SessionLog) => {
      const mentorId = s.mentor_id ?? s.mentor_invite_id;
      const menteeId = s.mentee_id ?? s.mentee_invite_id;
      if (!mentorId || !menteeId) throw new Error("导师和学员信息不完整。");
      return updateSession(s.id, {
        mentor_id: mentorId,
        mentee_id: menteeId,
        session_type: s.session_type,
        session_date: s.session_date,
        notes: s.notes,
      });
    },
    onSuccess: () => {
      setEditing(null);
      invalidate();
    },
  });

  const canSubmit = mentorId && menteeId && date && !mentorBlocked;

  return (
    <>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              活动纪录
            </Typography>
            {mentorBlocked && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                负责人尚未上传本项目的配对结果，暂时无法记录交流。
              </Alert>
            )}
            <Stack spacing={2}>
              <PersonAutocomplete
                label="导师"
                options={mentors}
                value={mentorId}
                onChange={setMentorId}
                disabled={isMentor}
                helperText={isMentor ? "导师只能记录自己的辅导场次" : undefined}
              />
              <PersonAutocomplete
                label="学员"
                options={mentees}
                value={menteeId}
                onChange={setMenteeId}
                disabled={mentorBlocked}
                helperText={isMentor ? "仅显示与你配对的学员" : undefined}
              />
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

        <Grid size={{ xs: 12, md: 8 }}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              最近的交流记录（{filterCopy.counted(filteredSessions.length, sessions?.length ?? 0)}）
            </Typography>
            {sessions && sessions.length > 0 && (
              <FilterRow>
                <FilterSearch
                  value={sessionQuery}
                  onChange={setSessionQuery}
                  placeholder={filterCopy.sessionSearch}
                />
                <FilterSelect
                  label={filterCopy.type}
                  value={typeFilter}
                  onChange={(v) => setTypeFilter(v as "all" | SessionType)}
                  options={[
                    { value: "all", label: portalCopy.tableFilters.all },
                    ...sessionTypes.map((t) => ({ value: t, label: sessionTypeLabels[t] })),
                  ]}
                />
                <FilterSelect
                  label={filterCopy.period}
                  value={periodFilter}
                  onChange={(v) => setPeriodFilter(v as Period)}
                  options={filterCopy.periods}
                />
                {filtersActive && (
                  <Button
                    size="small"
                    onClick={() => {
                      setSessionQuery("");
                      setTypeFilter("all");
                      setPeriodFilter("all");
                    }}
                  >
                    {filterCopy.clear}
                  </Button>
                )}
              </FilterRow>
            )}
            {sessions && sessions.length > 0 && filteredSessions.length === 0 ? (
              <Alert severity="info">{filterCopy.noMatch}</Alert>
            ) : sessions && sessions.length > 0 ? (
              <>
              <TableContainer>
                <Table size="small" sx={{ "& th, & td": { whiteSpace: "nowrap" } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>日期</TableCell>
                      <TableCell>导师</TableCell>
                      <TableCell>学员</TableCell>
                      <TableCell>类型</TableCell>
                      <TableCell>备注</TableCell>
                      {showActions && (
                        <TableCell align="right" sx={stickyActionsSx}>
                          操作
                        </TableCell>
                      )}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sessionPage.slice(filteredSessions).map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>{s.session_date}</TableCell>
                        <TableCell>{nameOf(s.mentor_id ?? s.mentor_invite_id)}</TableCell>
                        <TableCell>{nameOf(s.mentee_id ?? s.mentee_invite_id)}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            variant="outlined"
                            color={sessionTypeColors[s.session_type]}
                            label={sessionTypeLabels[s.session_type]}
                          />
                        </TableCell>
                        <TableCell sx={{ whiteSpace: "normal !important", minWidth: 160 }}>
                          <Typography
                            variant="body2"
                            title={s.notes ?? ""}
                            sx={{
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                              wordBreak: "break-word",
                            }}
                          >
                            {s.notes ?? "—"}
                          </Typography>
                        </TableCell>
                        {showActions && (
                          <TableCell align="right" sx={stickyActionsSx}>
                            <Tooltip title="编辑">
                              <IconButton aria-label="编辑" size="small" onClick={() => setEditing(s)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="删除">
                              <IconButton
                                aria-label="删除"
                                size="small"
                                onClick={() =>
                                  confirmDelete.ask({
                                    message: filterCopy.deleteSession(
                                      s.session_date,
                                      nameOf(s.mentor_id ?? s.mentor_invite_id),
                                      nameOf(s.mentee_id ?? s.mentee_invite_id),
                                    ),
                                    warning: filterCopy.deleteSessionWarning,
                                    run: () => deleteMutation.mutateAsync(s.id),
                                  })
                                }
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePager pagination={sessionPage} />
              </>
            ) : (
              <Alert severity="info">还没有任何交流记录。</Alert>
            )}
          </Paper>
        </Grid>
      </Grid>

      {confirmDelete.dialog}
      {canManage && (
        <ManagerParticipationSection cohortId={cohortId} nameOf={nameOf} />
      )}

      {showActions && (
        <EditSessionDialog
          session={editing}
          mentors={mentors}
          mentees={mentees}
          onClose={() => setEditing(null)}
          onSave={(s) => editMutation.mutate(s)}
          saving={editMutation.isPending}
        />
      )}
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
  mentors: SessionPerson[];
  mentees: SessionPerson[];
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
            <PersonAutocomplete
              label="导师"
              options={mentors}
              value={draft.mentor_id ?? draft.mentor_invite_id ?? ""}
              onChange={(id) =>
                setDraft({ ...draft, mentor_id: id, mentor_invite_id: null })
              }
            />
            <PersonAutocomplete
              label="学员"
              options={mentees}
              value={draft.mentee_id ?? draft.mentee_invite_id ?? ""}
              onChange={(id) =>
                setDraft({ ...draft, mentee_id: id, mentee_invite_id: null })
              }
            />
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

// ---------------------------------------------------------------------------
// Progress managers (admin, group leads, 人事组): mentees' activity records.
// ---------------------------------------------------------------------------

function ManagerParticipationSection({
  cohortId,
  nameOf,
}: {
  cohortId: string;
  nameOf: (id: string | null) => string;
}) {
  const queryClient = useQueryClient();
  const { data: records } = useQuery({
    queryKey: ["portal", "participation", cohortId, "all"],
    queryFn: () => listParticipation({ cohortId }),
  });
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["portal", "participation"] });

  const [editing, setEditing] = React.useState<ParticipationRecord | null>(null);
  const editMutation = useMutation({
    mutationFn: ({ record, eventName }: ParticipationEdit) =>
      managerUpdateParticipation(record.id, eventName),
    onSuccess: () => {
      setEditing(null);
      invalidate();
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => managerDeleteParticipation(id),
    onSuccess: invalidate,
  });
  const confirmDelete = useConfirmDelete();
  const [recordQuery, setRecordQuery] = React.useState("");
  const [shotFilter, setShotFilter] = React.useState<"all" | "with" | "without">("all");
  const [recordPeriod, setRecordPeriod] = React.useState<Period>("all");
  const recordFiltersActive =
    Boolean(recordQuery.trim()) || shotFilter !== "all" || recordPeriod !== "all";
  const filteredRecords = (records ?? []).filter(
    (r) =>
      (shotFilter === "all" || (shotFilter === "with") === Boolean(r.screenshot_path)) &&
      withinPeriod(r.created_at, recordPeriod) &&
      matchesSearch(recordQuery, [nameOf(r.mentee_id), r.event_name]),
  );
  const recordPage = usePagination(
    filteredRecords.length,
    `${recordQuery}|${shotFilter}|${recordPeriod}`,
    [12, 24, 48],
  );

  return (
    <Paper sx={{ p: 3, borderRadius: 3, mt: 3 }}>
      <Typography variant="h6" fontWeight={700} gutterBottom>
        {filterCopy.recordsTitle(filterCopy.counted(filteredRecords.length, records?.length ?? 0))}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {filterCopy.recordsIntro}
      </Typography>
      {records && records.length > 0 && (
        <FilterRow>
          <FilterSearch
            value={recordQuery}
            onChange={setRecordQuery}
            placeholder={filterCopy.recordSearch}
          />
          <FilterSelect
            label={filterCopy.screenshot}
            value={shotFilter}
            onChange={(v) => setShotFilter(v as "all" | "with" | "without")}
            options={filterCopy.screenshotOptions}
          />
          <FilterSelect
            label={filterCopy.period}
            value={recordPeriod}
            onChange={(v) => setRecordPeriod(v as Period)}
            options={filterCopy.periods}
          />
          {recordFiltersActive && (
            <Button
              size="small"
              onClick={() => {
                setRecordQuery("");
                setShotFilter("all");
                setRecordPeriod("all");
              }}
            >
              {filterCopy.clear}
            </Button>
          )}
        </FilterRow>
      )}
      {records && records.length > 0 && filteredRecords.length === 0 ? (
        <Alert severity="info">{filterCopy.noMatch}</Alert>
      ) : records && records.length > 0 ? (
        <Grid container spacing={1.5}>
          {recordPage.slice(filteredRecords).map((r) => (
            <Grid key={r.id} size={{ xs: 12, md: 6 }}>
              <ParticipationRow
                record={r}
                subtitle={nameOf(r.mentee_id)}
                onEdit={() => setEditing(r)}
                onDelete={() =>
                  confirmDelete.ask({
                    message: filterCopy.deleteRecord(r.event_name, nameOf(r.mentee_id)),
                    warning: filterCopy.deleteWarning,
                    run: () => deleteMutation.mutateAsync(r.id),
                  })
                }
              />
            </Grid>
          ))}
        </Grid>
      ) : (
        <Alert severity="info">{filterCopy.noRecords}</Alert>
      )}
      {filteredRecords.length > 0 && <TablePager pagination={recordPage} />}

      {confirmDelete.dialog}
      <EditParticipationDialog
        record={editing}
        allowScreenshot={false}
        saving={editMutation.isPending}
        error={editMutation.error}
        onClose={() => {
          setEditing(null);
          editMutation.reset();
        }}
        onSave={(edit) => editMutation.mutate(edit)}
      />
    </Paper>
  );
}

// ---------------------------------------------------------------------------
// Delete confirmation shared by every delete button on this page.
// ---------------------------------------------------------------------------

type DeleteRequest = { message: string; warning: string; run: () => Promise<unknown> };

/** How long the 已删除 check stays up before the dialog closes itself. */
const DELETED_VISIBLE_MS = 1100;

const popIn = keyframes`
  0% { transform: scale(0.6); opacity: 0; }
  60% { transform: scale(1.08); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
`;
const drawStroke = keyframes`
  to { stroke-dashoffset: 0; }
`;
const fadeUp = keyframes`
  from { transform: translateY(6px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
`;

/** A circle that pops in, then a check that draws itself, then the label. */
function DeletedCheck() {
  return (
    <Stack
      alignItems="center"
      spacing={1.5}
      sx={{
        py: 3,
        "@media (prefers-reduced-motion: reduce)": {
          "& *": { animation: "none !important", strokeDashoffset: "0 !important" },
        },
      }}
    >
      <Box
        component="svg"
        viewBox="0 0 52 52"
        aria-hidden
        sx={{
          width: 64,
          height: 64,
          color: "success.main",
          animation: `${popIn} 360ms cubic-bezier(0.2, 0.8, 0.2, 1) both`,
        }}
      >
        <Box
          component="circle"
          cx="26"
          cy="26"
          r="24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          sx={{
            strokeDasharray: 151,
            strokeDashoffset: 151,
            animation: `${drawStroke} 420ms ease-out 80ms forwards`,
          }}
        />
        <Box
          component="path"
          d="M15 27 l7 7 l15 -15"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          sx={{
            strokeDasharray: 36,
            strokeDashoffset: 36,
            animation: `${drawStroke} 280ms ease-out 420ms forwards`,
          }}
        />
      </Box>
      <Typography
        fontWeight={700}
        color="success.main"
        sx={{ animation: `${fadeUp} 260ms ease-out 520ms both` }}
      >
        {filterCopy.deleted}
      </Typography>
    </Stack>
  );
}

function useConfirmDelete() {
  const [request, setRequest] = React.useState<DeleteRequest | null>(null);
  const [pending, setPending] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(() => setRequest(null), DELETED_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [done]);

  const close = () => {
    if (pending) return;
    setRequest(null);
    setError(null);
  };
  const ask = (next: DeleteRequest) => {
    setDone(false);
    setError(null);
    setRequest(next);
  };
  const confirm = async () => {
    if (!request) return;
    setPending(true);
    setError(null);
    try {
      await request.run();
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : filterCopy.deleteFailed);
    } finally {
      setPending(false);
    }
  };

  const dialog = (
    <Dialog open={Boolean(request)} onClose={close} maxWidth="xs" fullWidth>
      {done ? (
        <DialogContent>
          <DeletedCheck />
        </DialogContent>
      ) : (
        <>
          <DialogTitle>{filterCopy.deleteTitle}</DialogTitle>
          <DialogContent>
            <Stack spacing={1.5}>
              {error && <Alert severity="error">{error}</Alert>}
              <Typography>{request?.message}</Typography>
              <Typography variant="body2" color="text.secondary">
                {request?.warning}
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={close} disabled={pending}>
              {filterCopy.cancel}
            </Button>
            <Button variant="contained" color="error" onClick={confirm} disabled={pending}>
              {filterCopy.confirmDelete}
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );

  return { ask, dialog };
}
