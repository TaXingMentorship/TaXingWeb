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
import CasinoIcon from "@mui/icons-material/Casino";
import SaveIcon from "@mui/icons-material/Save";
import type { Profile } from "@/types/portal";
import { getProfile, updateProfile } from "@/lib/portal/store";
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

  const isMentor = form.role === "mentor";
  const isMentee = form.role === "mentee";

  const handleSave = () => {
    mutation.mutate({
      full_name: form.full_name,
      wechat_number: form.wechat_number,
      bio: form.bio,
      field: form.field,
      background: form.background,
      interests: form.interests,
      goals: form.goals,
      linkedin: form.linkedin,
      avatar_url: form.avatar_url,
      // Mentors are always public so learners can find and match with them.
      visible: isMentor ? true : form.visible,
      years_experience: form.years_experience,
      mentee_capacity: form.mentee_capacity,
      mentee_expectations: form.mentee_expectations,
      topics: form.topics,
      help_needed: form.help_needed,
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
        <Grid size={{ xs: 12, md: 8 }}>
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
                label="昵称"
                value={form.full_name ?? ""}
                onChange={(e) => set("full_name", e.target.value)}
                fullWidth
              />
              <TextField
                label="微信号"
                value={form.wechat_number ?? ""}
                onChange={(e) => set("wechat_number", e.target.value)}
                fullWidth
                placeholder="方便导师或学员与你联系"
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
                label="领域"
                value={form.field ?? ""}
                onChange={(e) => set("field", e.target.value)}
                fullWidth
                placeholder="例如：互联网 · 产品管理"
              />
              <TextField
                label="学术经历 / 行业经历"
                value={form.background ?? ""}
                onChange={(e) => set("background", e.target.value)}
                fullWidth
                multiline
                minRows={2}
              />
              {isMentor && (
                <>
                  <TextField
                    label="工作年限"
                    value={form.years_experience ?? ""}
                    onChange={(e) => set("years_experience", e.target.value)}
                    fullWidth
                    placeholder="例如：8 年"
                  />
                  <TextField
                    label="可以帮助的 mentee 数量"
                    value={form.mentee_capacity ?? ""}
                    onChange={(e) => set("mentee_capacity", e.target.value)}
                    fullWidth
                    placeholder="可以提供大致范围，例如：2–3 名"
                  />
                  <TextField
                    label="对 mentee 的期望"
                    value={form.mentee_expectations ?? ""}
                    onChange={(e) => set("mentee_expectations", e.target.value)}
                    fullWidth
                    multiline
                    minRows={2}
                  />
                  <TextField
                    label="擅长与不擅长的话题"
                    value={form.topics ?? ""}
                    onChange={(e) => set("topics", e.target.value)}
                    fullWidth
                    multiline
                    minRows={2}
                    placeholder="例如：擅长产品面试；不太擅长算法"
                  />
                </>
              )}
              {isMentee && (
                <TextField
                  label="问题 / 想获得的帮助"
                  value={form.help_needed ?? ""}
                  onChange={(e) => set("help_needed", e.target.value)}
                  fullWidth
                  multiline
                  minRows={2}
                  placeholder="描述你希望从导师那里获得的帮助"
                />
              )}
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
              {isMentor ? (
                <FormControlLabel
                  control={<Switch checked disabled />}
                  label="导师资料默认公开，方便学员了解并与你匹配"
                />
              ) : isMentee ? (
                <Box>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={form.visible}
                        onChange={(e) => set("visible", e.target.checked)}
                      />
                    }
                    label="在成员目录中公开我的资料"
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    推荐公开信息，方便与 mentor 匹配。
                  </Typography>
                </Box>
              ) : null}
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
