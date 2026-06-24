"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
import Avatar from "@mui/material/Avatar";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import Divider from "@mui/material/Divider";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemText from "@mui/material/ListItemText";
import CasinoIcon from "@mui/icons-material/Casino";
import SaveIcon from "@mui/icons-material/Save";
import EventNoteIcon from "@mui/icons-material/EventNote";
import type { Profile } from "@/types/portal";
import { getProfile, listProfiles, listSessions, updateProfile } from "@/lib/portal/store";
import { roleLabels } from "@/data/portalCopy";
import { usePortalSession } from "@/components/portal/PortalSessionProvider";

const interestSuggestions = [
  "产品管理",
  "数据科学",
  "机器学习",
  "软件工程",
  "后端开发",
  "用户体验",
  "设计思维",
  "市场营销",
  "品牌策略",
  "职业规划",
  "求职面试",
  "技术面试",
  "女性领导力",
  "职场沟通",
  "作品集",
  "转行",
];

export default function MyProfilePage() {
  const { currentUser } = usePortalSession();
  const queryClient = useQueryClient();
  const userId = currentUser?.id;

  const { data: profile } = useQuery({
    queryKey: ["portal", "profile", userId],
    queryFn: () => getProfile(userId!),
    enabled: Boolean(userId),
  });

  const [form, setForm] = React.useState<Profile | null>(null);
  const [toast, setToast] = React.useState(false);

  React.useEffect(() => {
    if (profile) setForm(profile);
  }, [profile]);

  const mutation = useMutation({
    mutationFn: (patch: Partial<Profile>) => updateProfile(userId!, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal", "profile", userId] });
      queryClient.invalidateQueries({ queryKey: ["portal", "profiles"] });
      queryClient.invalidateQueries({ queryKey: ["portal", "currentUser"] });
      setToast(true);
    },
  });

  if (!form) {
    return <Typography color="text.secondary">加载中…</Typography>;
  }

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    setForm({ ...form, [key]: value });

  const randomizeAvatar = () =>
    set(
      "avatar_url",
      `https://api.dicebear.com/9.x/avataaars/svg?seed=${Math.random()
        .toString(36)
        .slice(2)}`,
    );

  const handleSave = () => {
    mutation.mutate({
      full_name: form.full_name,
      bio: form.bio,
      background: form.background,
      interests: form.interests,
      goals: form.goals,
      linkedin: form.linkedin,
      avatar_url: form.avatar_url,
      visible: form.visible,
    });
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight={800} gutterBottom>
        我的资料
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        完善你的个人资料，让导师或学员更好地了解你。
      </Typography>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
              <Avatar src={form.avatar_url ?? undefined} sx={{ width: 72, height: 72 }} />
              <Box>
                <Typography variant="h6" fontWeight={700}>
                  {form.full_name}
                </Typography>
                <Chip size="small" label={roleLabels[form.role]} color="secondary" sx={{ mb: 1 }} />
                <Box>
                  <Button size="small" startIcon={<CasinoIcon />} onClick={randomizeAvatar}>
                    随机更换头像
                  </Button>
                </Box>
              </Box>
            </Stack>

            <Stack spacing={2.5}>
              <TextField
                label="姓名"
                value={form.full_name ?? ""}
                onChange={(e) => set("full_name", e.target.value)}
                fullWidth
              />
              <TextField
                label="一句话简介"
                value={form.bio ?? ""}
                onChange={(e) => set("bio", e.target.value)}
                fullWidth
                multiline
                minRows={2}
              />
              <TextField
                label="背景经历"
                value={form.background ?? ""}
                onChange={(e) => set("background", e.target.value)}
                fullWidth
                multiline
                minRows={2}
              />
              <TextField
                label="目标"
                value={form.goals ?? ""}
                onChange={(e) => set("goals", e.target.value)}
                fullWidth
                multiline
                minRows={2}
              />
              <Autocomplete
                multiple
                freeSolo
                options={interestSuggestions}
                value={form.interests}
                onChange={(_, v) => set("interests", v as string[])}
                renderInput={(params) => (
                  <TextField {...params} label="兴趣方向" placeholder="输入后回车添加" />
                )}
              />
              <TextField
                label="LinkedIn 链接"
                value={form.linkedin ?? ""}
                onChange={(e) => set("linkedin", e.target.value)}
                fullWidth
                placeholder="https://www.linkedin.com/in/..."
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={form.visible}
                    onChange={(e) => set("visible", e.target.checked)}
                  />
                }
                label="在成员目录中公开我的资料"
              />
              <Divider />
              <Box>
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<SaveIcon />}
                  onClick={handleSave}
                  disabled={mutation.isPending}
                >
                  保存资料
                </Button>
              </Box>
            </Stack>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <MySessionsWidget profile={form} />
        </Grid>
      </Grid>

      <Snackbar
        open={toast}
        autoHideDuration={3000}
        onClose={() => setToast(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" onClose={() => setToast(false)}>
          资料已保存
        </Alert>
      </Snackbar>
    </Box>
  );
}

function MySessionsWidget({ profile }: { profile: Profile }) {
  const { data: sessions } = useQuery({
    queryKey: ["portal", "mySessions", profile.id],
    queryFn: async () => {
      const asMentor = await listSessions({ mentorId: profile.id });
      const asMentee = await listSessions({ menteeId: profile.id });
      return [...asMentor, ...asMentee].sort((a, b) =>
        b.session_date.localeCompare(a.session_date),
      );
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["portal", "profiles"],
    queryFn: () => listProfiles(),
  });

  const nameOf = (id: string) =>
    profiles?.find((p) => p.id === id)?.full_name ?? "未知";

  return (
    <Paper sx={{ p: 3, borderRadius: 3 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <EventNoteIcon color="secondary" />
        <Typography variant="h6" fontWeight={700}>
          我的辅导记录
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        共 {sessions?.length ?? 0} 次记录（由管理员录入）。
      </Typography>
      {profile.role === "admin" ? (
        <Alert severity="info">管理员账号没有个人辅导记录。</Alert>
      ) : sessions && sessions.length > 0 ? (
        <List dense>
          {sessions.map((s) => {
            const partnerId =
              s.mentor_id === profile.id ? s.mentee_id : s.mentor_id;
            const partnerRole =
              s.mentor_id === profile.id ? "学员" : "导师";
            return (
              <ListItem key={s.id} disableGutters>
                <ListItemAvatar>
                  <Avatar
                    src={
                      profiles?.find((p) => p.id === partnerId)?.avatar_url ??
                      undefined
                    }
                  />
                </ListItemAvatar>
                <ListItemText
                  primary={`${s.session_date} · 与${partnerRole} ${nameOf(partnerId)}`}
                  secondary={s.notes ?? undefined}
                />
              </ListItem>
            );
          })}
        </List>
      ) : (
        <Alert severity="info">暂时还没有辅导记录。</Alert>
      )}
    </Paper>
  );
}
