"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Alert from "@mui/material/Alert";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TablePagination from "@mui/material/TablePagination";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Avatar from "@mui/material/Avatar";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import type { Profile, RosterInvite } from "@/types/portal";
import {
  listCohorts,
  listMatches,
  listParticipation,
  listProfiles,
  listRosterInvites,
  listSessions,
  updateProfile,
} from "@/lib/portal/store";
import IdentityCell from "@/components/portal/IdentityCell";
import { profileLabels } from "@/data/portalCopy";
import NameChangeReviewCard from "@/components/portal/NameChangeReviewCard";
import PendingInvites from "@/components/portal/PendingInvites";
import Divider from "@mui/material/Divider";
import { usePortalSession } from "@/components/portal/PortalSessionProvider";

export default function RosterPage() {
  const { currentUser } = usePortalSession();
  const queryClient = useQueryClient();

  const { data: cohorts } = useQuery({ queryKey: ["portal", "cohorts"], queryFn: listCohorts });

  const [cohortId, setCohortId] = React.useState("");
  React.useEffect(() => {
    if (!cohortId && cohorts?.length) setCohortId(cohorts[0].id);
  }, [cohorts, cohortId]);

  const { data: profiles } = useQuery({
    queryKey: ["portal", "profiles"],
    queryFn: () => listProfiles(),
  });

  const { data: invites } = useQuery({
    queryKey: ["portal", "rosterInvites", cohortId],
    queryFn: () => listRosterInvites(cohortId),
    enabled: Boolean(cohortId),
  });

  const { data: sessions } = useQuery({
    queryKey: ["portal", "sessions", cohortId, "all"],
    queryFn: () => listSessions({ cohortId }),
    enabled: Boolean(cohortId),
  });

  const { data: participation } = useQuery({
    queryKey: ["portal", "participation", cohortId],
    queryFn: () => listParticipation({ cohortId }),
    enabled: Boolean(cohortId),
  });

  const { data: matches } = useQuery({
    queryKey: ["portal", "matches", cohortId],
    queryFn: () => listMatches({ cohortId }),
    enabled: Boolean(cohortId),
  });

  const [view, setView] = React.useState<"table" | "pairs">("table");

  // Table filters. Any change sends the table back to its first page, so a
  // narrower result never leaves you looking at an empty page 7.
  const [search, setSearch] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState("all");
  const [doneFilter, setDoneFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(25);
  React.useEffect(() => {
    setPage(0);
  }, [cohortId, search, roleFilter, doneFilter, statusFilter, rowsPerPage]);

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateProfile>[1] }) =>
      updateProfile(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal", "profiles"] });
    },
  });

  const rows = React.useMemo(() => {
    const members = (profiles ?? []).filter(
      (p) => p.participant_role !== null && p.cohort_ids.includes(cohortId),
    );
    return members.map((p) => {
      const sessionCount = (sessions ?? []).filter((s) =>
        p.participant_role === "mentor"
          ? s.mentor_id === p.id
          : s.mentee_id === p.id,
      ).length;
      const submitted =
        p.participant_role === "mentee"
          ? (participation ?? []).some((r) => r.mentee_id === p.id)
          : null;
      // A mentee "provided a gratitude note" if a mentor logged a 感谢赠言 session for them.
      const gaveGratitude =
        p.participant_role === "mentee"
          ? (sessions ?? []).some(
              (s) => s.mentee_id === p.id && s.session_type === "gratitude",
            )
          : null;
      // "全部完成" is derived from submitted records, not editable on the site.
      const completedAll =
        p.participant_role === "mentee"
          ? Boolean(submitted) && Boolean(gaveGratitude)
          : sessionCount > 0;
      return { profile: p, sessionCount, submitted, gaveGratitude, completedAll };
    });
  }, [profiles, sessions, participation, cohortId]);

  // Invited but not yet signed in: no profile exists, so they are not in
  // `rows`. They get a row of their own so activated and waiting people can be
  // told apart, and filtered, in the one table.
  const waitingInvites = React.useMemo(
    () => (invites ?? []).filter((invite) => !invite.claimed_user_id),
    [invites],
  );

  type Entry =
    | { kind: "member"; row: (typeof rows)[number] }
    | { kind: "invited"; invite: RosterInvite };

  const entries = React.useMemo<Entry[]>(
    () => [
      ...rows.map((row): Entry => ({ kind: "member", row })),
      ...[...waitingInvites]
        .sort((a, b) => Number(a.not_participating) - Number(b.not_participating))
        .map((invite): Entry => ({ kind: "invited", invite })),
    ],
    [rows, waitingInvites],
  );

  const filteredRows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((entry) => {
      const id =
        entry.kind === "member"
          ? {
              name: entry.row.profile.full_name,
              email: entry.row.profile.email,
              wechat: entry.row.profile.wechat_number,
              notes: entry.row.profile.admin_notes,
              mentor: entry.row.profile.participant_role === "mentor",
              mentee: entry.row.profile.participant_role === "mentee",
              volunteer: entry.row.profile.is_volunteer,
              admin: entry.row.profile.is_admin,
            }
          : {
              name: entry.invite.full_name,
              email: entry.invite.email,
              wechat: null,
              notes: null,
              mentor: entry.invite.participant_role === "mentor",
              mentee: entry.invite.participant_role === "mentee",
              volunteer: entry.invite.is_volunteer,
              admin: entry.invite.is_admin,
            };
      if (q) {
        const haystack = [id.name, id.email, id.wechat, id.notes]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (roleFilter !== "all" && !id[roleFilter as "mentor" | "mentee" | "volunteer" | "admin"]) {
        return false;
      }
      if (statusFilter === "active" && entry.kind !== "member") return false;
      if (statusFilter === "waiting") {
        if (entry.kind !== "invited" || entry.invite.not_participating) return false;
      }
      if (statusFilter === "out") {
        if (entry.kind !== "invited" || !entry.invite.not_participating) return false;
      }
      // Completion is about activity records; someone who has not signed in
      // has none, so the filter only speaks about activated members.
      if (doneFilter !== "all") {
        if (entry.kind !== "member") return false;
        if (doneFilter === "done" && !entry.row.completedAll) return false;
        if (doneFilter === "todo" && entry.row.completedAll) return false;
      }
      return true;
    });
  }, [entries, search, roleFilter, doneFilter, statusFilter]);

  const pagedRows = React.useMemo(
    () => filteredRows.slice(page * rowsPerPage, (page + 1) * rowsPerPage),
    [filteredRows, page, rowsPerPage],
  );

  const rowByProfileId = React.useMemo(
    () => new Map(rows.map((r) => [r.profile.id, r])),
    [rows],
  );

  // Nested view: each mentor with their matched mentees (from uploaded matches).
  const pairGroups = React.useMemo(() => {
    const mentors = (profiles ?? [])
      .filter((p) => p.participant_role === "mentor" && p.cohort_ids.includes(cohortId))
      .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));
    const cohortMatches = (matches ?? []).filter((m) => m.cohort_id === cohortId);
    const matchedMenteeIds = new Set(cohortMatches.map((m) => m.mentee_id));
    const groups = mentors.map((mentor) => {
      const menteeIds = cohortMatches
        .filter((m) => m.mentor_id === mentor.id)
        .map((m) => m.mentee_id);
      const mentees = menteeIds
        .map((id) => (profiles ?? []).find((p) => p.id === id))
        .filter((p): p is Profile => Boolean(p));
      return { mentor, mentees };
    });
    const unmatched = (profiles ?? []).filter(
      (p) =>
        p.participant_role === "mentee" &&
        p.cohort_ids.includes(cohortId) &&
        !matchedMenteeIds.has(p.id),
    );
    return { groups, unmatched, hasMatches: cohortMatches.length > 0 };
  }, [profiles, matches, cohortId]);

  if (!currentUser?.is_admin) {
    return <Alert severity="error">仅负责人可访问成员名单。</Alert>;
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight={800} gutterBottom>
        成员名单
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        查看本期成员信息、交流场次与活动记录提交情况。名单内容自动汇总自提交的记录，
        仅「备注」可在网站上直接编辑。
      </Typography>

      <NameChangeReviewCard />

      <Stack
        direction="row"
        spacing={1.5}
        useFlexGap
        flexWrap="wrap"
        alignItems="center"
        sx={{ mb: 3 }}
      >
        <TextField
          select
          size="small"
          label="项目"
          value={cohortId}
          onChange={(e) => setCohortId(e.target.value)}
          sx={{ minWidth: 150 }}
        >
          {(cohorts ?? []).map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.name}
            </MenuItem>
          ))}
        </TextField>

        <ToggleButtonGroup
          size="small"
          exclusive
          value={view}
          onChange={(_, v) => v && setView(v)}
        >
          <ToggleButton value="table">名单表格</ToggleButton>
          <ToggleButton value="pairs">配对关系</ToggleButton>
        </ToggleButtonGroup>
      {view === "table" && (
        <>
          <TextField
            size="small"
            label="搜索"
            placeholder="姓名 / 邮箱 / 微信号 / 备注"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ flex: "1 1 200px", maxWidth: 280, minWidth: 160 }}
          />
          <TextField
            select
            size="small"
            label="激活状态"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            sx={{ minWidth: 130 }}
          >
            <MenuItem value="all">全部</MenuItem>
            <MenuItem value="active">已激活</MenuItem>
            <MenuItem value="waiting">已邀请 · 待激活</MenuItem>
            <MenuItem value="out">不参与本次项目</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            label="身份"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            sx={{ minWidth: 130 }}
          >
            <MenuItem value="all">全部身份</MenuItem>
            <MenuItem value="mentor">导师</MenuItem>
            <MenuItem value="mentee">学员</MenuItem>
            <MenuItem value="volunteer">志愿者</MenuItem>
            <MenuItem value="admin">负责人</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            label="完成情况"
            value={doneFilter}
            onChange={(e) => setDoneFilter(e.target.value)}
            sx={{ minWidth: 130 }}
          >
            <MenuItem value="all">全部</MenuItem>
            <MenuItem value="done">已完成</MenuItem>
            <MenuItem value="todo">未完成</MenuItem>
          </TextField>
          <Typography variant="body2" color="text.secondary">
            共 {filteredRows.length} 人
            {filteredRows.length !== entries.length ? `（筛选自 ${entries.length} 人）` : ""}
          </Typography>
        </>
      )}
      </Stack>

      {view === "table" ? (
        <>
        <Paper sx={{ borderRadius: 3, overflow: "hidden" }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>姓名</TableCell>
                  <TableCell>邮箱</TableCell>
                  <TableCell>微信号</TableCell>
                  <TableCell>身份</TableCell>
                  <TableCell>状态</TableCell>
                  <TableCell align="right">交流场次</TableCell>
                  <TableCell align="center">活动记录</TableCell>
                  <TableCell align="center">感谢赠言</TableCell>
                  <TableCell align="center">全部完成</TableCell>
                  <TableCell>备注</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11}>
                      <Alert severity="info" sx={{ my: 1 }}>
                        {entries.length === 0 ? "该项目暂时没有成员。" : "没有符合筛选条件的成员。"}
                      </Alert>
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedRows.map((entry) =>
                    entry.kind === "invited" ? (
                    <TableRow
                      key={entry.invite.id}
                      hover
                      sx={{
                        bgcolor: entry.invite.not_participating ? "action.selected" : undefined,
                        color: entry.invite.not_participating ? "text.secondary" : undefined,
                      }}
                    >
                      <TableCell>—</TableCell>
                      <TableCell>{entry.invite.full_name ?? "—"}</TableCell>
                      <TableCell>{entry.invite.email}</TableCell>
                      <TableCell>—</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                          {profileLabels(entry.invite).map((label) => (
                            <Chip key={label} size="small" variant="outlined" label={label} />
                          ))}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        {entry.invite.not_participating ? (
                          <Chip size="small" color="default" label="不参与本次项目" />
                        ) : (
                          <Chip size="small" color="warning" variant="outlined" label="待激活" />
                        )}
                      </TableCell>
                      <TableCell align="right">—</TableCell>
                      <TableCell align="center">—</TableCell>
                      <TableCell align="center">—</TableCell>
                      <TableCell align="center">—</TableCell>
                      <TableCell>—</TableCell>
                    </TableRow>
                    ) : (() => {
                    const { profile, sessionCount, submitted, gaveGratitude, completedAll } = entry.row;
                    return (
                    <TableRow key={profile.id} hover>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {profile.id}
                        </Typography>
                      </TableCell>
                      <TableCell>{profile.full_name ?? "—"}</TableCell>
                      <TableCell>{profile.email ?? "—"}</TableCell>
                      <TableCell>{profile.wechat_number ?? "—"}</TableCell>
                      <TableCell>
                        <IdentityCell profile={profile} />
                      </TableCell>
                      <TableCell>
                        <Chip size="small" color="success" label="已激活" />
                      </TableCell>
                      <TableCell align="right">{sessionCount}</TableCell>
                      <TableCell align="center">
                        {submitted === null ? (
                          <Typography variant="body2" color="text.secondary">
                            —
                          </Typography>
                        ) : submitted ? (
                          <Chip size="small" color="success" label="已提交" />
                        ) : (
                          <Chip size="small" color="warning" variant="outlined" label="未提交" />
                        )}
                      </TableCell>
                      <TableCell align="center">
                        {gaveGratitude === null ? (
                          <Typography variant="body2" color="text.secondary">
                            —
                          </Typography>
                        ) : gaveGratitude ? (
                          <Chip size="small" color="success" label="已提供" />
                        ) : (
                          <Chip size="small" color="default" variant="outlined" label="未提供" />
                        )}
                      </TableCell>
                      <TableCell align="center">
                        {completedAll ? (
                          <Chip size="small" color="success" label="已完成" />
                        ) : (
                          <Chip size="small" color="default" variant="outlined" label="未完成" />
                        )}
                      </TableCell>
                      <TableCell>
                        <NotesCell
                          value={profile.admin_notes}
                          onSave={(v) =>
                            updateMutation.mutate({
                              id: profile.id,
                              patch: { admin_notes: v },
                            })
                          }
                        />
                      </TableCell>
                    </TableRow>
                    );
                    })(),
                  )
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={filteredRows.length}
            page={page}
            onPageChange={(_, next) => setPage(next)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => setRowsPerPage(Number(e.target.value))}
            rowsPerPageOptions={[25, 50, 100]}
            labelRowsPerPage="每页"
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`}
          />
        </Paper>
        </>
      ) : !pairGroups.hasMatches ? (
        <Alert severity="info">
          负责人尚未上传本项目的配对结果。请在「名单导入」页上传配对表。
        </Alert>
      ) : (
        <Stack spacing={2}>
          {pairGroups.groups.map(({ mentor, mentees }) => (
            <Paper key={mentor.id} sx={{ p: 2.5, borderRadius: 3 }}>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                <Avatar src={mentor.avatar_url ?? undefined} sx={{ width: 40, height: 40 }} />
                <Box sx={{ flexGrow: 1 }}>
                  <Typography fontWeight={700}>{mentor.full_name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    导师 · {mentor.id}
                  </Typography>
                </Box>
                <Chip size="small" label={`${mentees.length} 名学员`} color="primary" variant="outlined" />
              </Stack>
              {mentees.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ pl: 6.5 }}>
                  暂无配对学员。
                </Typography>
              ) : (
                <Stack spacing={1} sx={{ pl: 6.5 }}>
                  {mentees.map((mentee) => {
                    const r = rowByProfileId.get(mentee.id);
                    return (
                      <Stack
                        key={mentee.id}
                        direction="row"
                        spacing={1.5}
                        alignItems="center"
                      >
                        <Avatar
                          src={mentee.avatar_url ?? undefined}
                          sx={{ width: 28, height: 28 }}
                        />
                        <Typography variant="body2" sx={{ flexGrow: 1 }}>
                          {mentee.full_name}
                          <Typography component="span" variant="caption" color="text.secondary">
                            {" "}
                            · {mentee.id}
                          </Typography>
                        </Typography>
                        <Chip
                          size="small"
                          variant="outlined"
                          label={`交流 ${r?.sessionCount ?? 0}`}
                        />
                        {r?.completedAll ? (
                          <Chip size="small" color="success" label="已完成" />
                        ) : (
                          <Chip size="small" color="default" variant="outlined" label="未完成" />
                        )}
                      </Stack>
                    );
                  })}
                </Stack>
              )}
            </Paper>
          ))}
          {pairGroups.unmatched.length > 0 && (
            <Paper sx={{ p: 2.5, borderRadius: 3 }}>
              <Typography fontWeight={700} gutterBottom>
                未配对学员（{pairGroups.unmatched.length}）
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ pl: 0.5 }}>
                {pairGroups.unmatched.map((mentee) => (
                  <Chip
                    key={mentee.id}
                    avatar={<Avatar src={mentee.avatar_url ?? undefined} />}
                    label={mentee.full_name ?? mentee.id}
                    variant="outlined"
                  />
                ))}
              </Stack>
            </Paper>
          )}
        </Stack>
      )}
      <Divider sx={{ my: 5 }} />

      <PendingInvites />

    </Box>
  );
}

function NotesCell({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (value: string | null) => void;
}) {
  const [text, setText] = React.useState(value ?? "");

  React.useEffect(() => {
    setText(value ?? "");
  }, [value]);

  const commit = () => {
    const next = text.trim() || null;
    if (next !== (value ?? null)) onSave(next);
  };

  return (
    <TextField
      variant="standard"
      size="small"
      placeholder="添加备注"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      sx={{ minWidth: 140 }}
    />
  );
}
