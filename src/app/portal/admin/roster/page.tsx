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
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Avatar from "@mui/material/Avatar";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import type { Profile } from "@/types/portal";
import {
  listCohorts,
  listMatches,
  listParticipation,
  listProfiles,
  listSessions,
  updateProfile,
} from "@/lib/portal/store";
import { profileLabels } from "@/data/portalCopy";
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
    return <Alert severity="error">仅管理员可访问成员名单。</Alert>;
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

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems={{ sm: "center" }}
        sx={{ mb: 3 }}
      >
        <TextField
          select
          size="small"
          label="项目"
          value={cohortId}
          onChange={(e) => setCohortId(e.target.value)}
          sx={{ minWidth: 240 }}
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
      </Stack>

      {view === "table" ? (
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
                  <TableCell align="right">交流场次</TableCell>
                  <TableCell align="center">活动记录</TableCell>
                  <TableCell align="center">感谢赠言</TableCell>
                  <TableCell align="center">全部完成</TableCell>
                  <TableCell>备注</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10}>
                      <Alert severity="info" sx={{ my: 1 }}>
                        该项目暂时没有成员。
                      </Alert>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map(({ profile, sessionCount, submitted, gaveGratitude, completedAll }) => (
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
                        <Chip
                          size="small"
                          label={profileLabels(profile).join(" · ")}
                          color={profile.participant_role === "mentor" ? "primary" : "default"}
                          variant="outlined"
                        />
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
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      ) : !pairGroups.hasMatches ? (
        <Alert severity="info">
          管理员尚未上传本项目的配对结果。请在「名单导入」页上传配对表。
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
