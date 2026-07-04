"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
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
import {
  listCohorts,
  listParticipation,
  listProfiles,
  listSessions,
} from "@/lib/portal/store";
import { roleLabels } from "@/data/portalCopy";
import { usePortalSession } from "@/components/portal/PortalSessionProvider";

export default function RosterPage() {
  const { currentUser } = usePortalSession();

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

  const rows = React.useMemo(() => {
    const members = (profiles ?? []).filter(
      (p) => p.role !== "admin" && p.cohort_ids.includes(cohortId),
    );
    return members.map((p) => {
      const sessionCount = (sessions ?? []).filter((s) =>
        p.role === "mentor" ? s.mentor_id === p.id : s.mentee_id === p.id,
      ).length;
      const submitted =
        p.role === "mentee"
          ? (participation ?? []).some((r) => r.mentee_id === p.id)
          : null;
      return { profile: p, sessionCount, submitted };
    });
  }, [profiles, sessions, participation, cohortId]);

  if (currentUser?.role !== "admin") {
    return <Alert severity="error">仅管理员可访问成员名单。</Alert>;
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight={800} gutterBottom>
        成员名单
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        查看本期成员信息、辅导场次与活动记录提交情况。
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
                <TableCell align="right">辅导场次</TableCell>
                <TableCell align="center">活动记录</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Alert severity="info" sx={{ my: 1 }}>
                      该项目暂时没有成员。
                    </Alert>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map(({ profile, sessionCount, submitted }) => (
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
                        label={roleLabels[profile.role]}
                        color={profile.role === "mentor" ? "primary" : "default"}
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
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
