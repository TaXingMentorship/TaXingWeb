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
import UploadFileIcon from "@mui/icons-material/UploadFile";
import SaveIcon from "@mui/icons-material/Save";
import type { Profile } from "@/types/portal";
import { getProfile, updateProfile } from "@/lib/portal/store";
import {
  AVATAR_MAX_BYTES,
  IMAGE_ACCEPT,
  removeReplacedAvatar,
  uploadAvatar,
  validateImageFile,
} from "@/lib/portal/uploads";
import { portalCopy, profileLabels } from "@/data/portalCopy";
import { usePortalSession } from "@/components/portal/PortalSessionProvider";
import MyVolunteerSection from "@/components/portal/MyVolunteerSection";
import NameChangeField from "@/components/portal/NameChangeField";
import MentorGroupField from "@/components/portal/MentorGroupField";
import { useCompleteTasksLinkingTo } from "@/components/portal/useMyTasks";

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

// Example text in an empty box: softer than typed text, with room between lines.
const exampleSx = {
  "& textarea::placeholder": { opacity: 0.6, lineHeight: 1.8 },
  "& textarea": { lineHeight: 1.8 },
};

const filled = (v: string | null | undefined) => Boolean((v ?? "").trim());

function RequiredTag() {
  return <Chip size="small" color="error" variant="outlined" label={portalCopy.requiredTag} />;
}

function RequiredLabel({ text }: { text: string }) {
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
      {text}
      <RequiredTag />
    </Box>
  );
}

export default function MyProfilePage() {
  const { currentUser, realUser } = usePortalSession();
  const queryClient = useQueryClient();
  const userId = currentUser?.id;
  // A 「完善志愿者信息」 task links here; saving anything on this page closes it.
  const completeProfileTasks = useCompleteTasksLinkingTo("/portal/me");

  const { data: profile } = useQuery({
    queryKey: ["portal", "profile", userId],
    queryFn: () => getProfile(userId!),
    enabled: Boolean(userId),
  });

  const [form, setForm] = React.useState<Profile | null>(null);
  const [toast, setToast] = React.useState(false);
  const [tried, setTried] = React.useState(false);
  const [avatarPreview, setAvatarPreview] = React.useState<string | null>(null);
  const [avatarError, setAvatarError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (profile) setForm(profile);
  }, [profile]);

  const mutation = useMutation({
    mutationFn: (patch: Parameters<typeof updateProfile>[1]) =>
      updateProfile(userId!, patch),
    onSuccess: async (updated, patch) => {
      queryClient.invalidateQueries({ queryKey: ["portal", "profile", userId] });
      queryClient.invalidateQueries({ queryKey: ["portal", "profiles"] });
      queryClient.invalidateQueries({ queryKey: ["portal", "currentUser"] });
      if (
        patch.avatar_url &&
        profile?.avatar_url &&
        patch.avatar_url !== profile.avatar_url
      ) {
        try {
          await removeReplacedAvatar(profile.avatar_url);
        } catch (cleanupError) {
          setAvatarError(
            cleanupError instanceof Error
              ? `资料已保存，但${cleanupError.message}`
              : "资料已保存，但旧头像清理失败。",
          );
        }
      }
      setForm(updated);
      setToast(true);
      completeProfileTasks();
    },
  });

  const avatarMutation = useMutation({
    mutationFn: (file: File) => uploadAvatar(userId!, file),
    onSuccess: (url) => {
      setForm((current) =>
        current ? { ...current, avatar_url: url } : current,
      );
      setAvatarError(null);
    },
    onError: (uploadError) => {
      setAvatarPreview(null);
      setAvatarError(
        uploadError instanceof Error ? uploadError.message : "头像上传失败。",
      );
    },
  });

  React.useEffect(
    () => () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    },
    [avatarPreview],
  );

  if (!form) {
    return <Typography color="text.secondary">加载中…</Typography>;
  }

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    setForm({ ...form, [key]: value });

  const handleAvatar = (file: File | undefined) => {
    if (!file) return;
    const validationError = validateImageFile(file, AVATAR_MAX_BYTES);
    if (validationError) {
      setAvatarError(validationError);
      return;
    }

    setAvatarError(null);
    setAvatarPreview(URL.createObjectURL(file));
    avatarMutation.mutate(file);
  };

  // The fields shown follow the persona lens; what is saved follows the real
  // account, so previewing as a mentor never flips an admin's own visibility.
  const shownRole = currentUser ? currentUser.participant_role : form.participant_role;
  const isMentor = shownRole === "mentor";
  const isMentee = shownRole === "mentee";
  const isRealMentor = form.participant_role === "mentor";

  const qaMissing = isMentor && !filled(form.qa_intro);
  const qaTopicMissing = isMentor && !filled(form.qa_topic);
  // Mentor profile fields that must be filled in before saving.
  const mentorFieldsMissing =
    isMentor &&
    [form.bio, form.field, form.can_help, form.mentee_capacity, form.mentee_expectations, form.topics].some((v) => !filled(v));

  const handleSave = () => {
    // Required mentor fields: refuse the save and point at the first empty one.
    if (mentorFieldsMissing || qaMissing || qaTopicMissing) {
      setTried(true);
      const order: [string, string | null | undefined][] = [
        ["mentor-bio", form.bio],
        ["mentor-field", form.field],
        ["mentor-can-help", form.can_help],
        ["mentor-capacity", form.mentee_capacity],
        ["mentor-expectations", form.mentee_expectations],
        ["mentor-topics", form.topics],
        ["qa-intro", form.qa_intro],
        ["qa-topic", form.qa_topic],
      ];
      const first = order.find(([, v]) => !filled(v))?.[0];
      if (first) document.getElementById(first)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    mutation.mutate({
      // Nicknames are locked for everyone but admins (migration 0021): sending
      // the field would be rejected if it were stale, so it isn't sent.
      ...(currentUser?.is_admin ? { full_name: form.full_name } : {}),
      name_pronunciation: form.name_pronunciation,
      wechat_number: form.wechat_number,
      bio: form.bio,
      field: form.field,
      background: form.background,
      interests: form.interests,
      linkedin: form.linkedin,
      avatar_url: form.avatar_url,
      // Mentors are always public so learners can find and match with them.
      visible: isRealMentor ? true : form.visible,
      years_experience: form.years_experience,
      mentee_capacity: form.mentee_capacity,
      mentee_expectations: form.mentee_expectations,
      topics: form.topics,
      qa_intro: form.qa_intro,
      qa_topic: form.qa_topic,
      can_help: form.can_help,
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
              <Avatar
                src={avatarPreview ?? form.avatar_url ?? undefined}
                sx={{ width: 72, height: 72 }}
              />
              <Box>
                <Typography variant="h6" fontWeight={700}>
                  {form.full_name}
                </Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
                  {profileLabels(form).map((label) => (
                    <Chip key={label} size="small" label={label} color="secondary" />
                  ))}
                </Stack>
                <Box>
                  <Button
                    component="label"
                    size="small"
                    startIcon={<UploadFileIcon />}
                    disabled={avatarMutation.isPending}
                  >
                    {avatarMutation.isPending ? "上传中…" : "上传头像"}
                    <input
                      type="file"
                      accept={IMAGE_ACCEPT}
                      hidden
                      onChange={(event) => {
                        handleAvatar(event.target.files?.[0]);
                        event.target.value = "";
                      }}
                    />
                  </Button>
                  <Typography variant="caption" color="text.secondary" display="block">
                    JPEG、PNG 或 WebP，最大 2 MB
                  </Typography>
                </Box>
              </Box>
            </Stack>

            <Stack spacing={2.5}>
              {avatarError && <Alert severity="error">{avatarError}</Alert>}
              {mutation.isError && (
                <Alert severity="error">
                  {mutation.error instanceof Error
                    ? mutation.error.message
                    : "资料保存失败。"}
                </Alert>
              )}
              <NameChangeField
                name={form.full_name ?? ""}
                onNameChange={(value) => set("full_name", value)}
              />
              <TextField
                label={portalCopy.namePronunciation.fieldLabel}
                value={form.name_pronunciation ?? ""}
                onChange={(e) => set("name_pronunciation", e.target.value)}
                fullWidth
                placeholder={portalCopy.namePronunciation.placeholder}
                helperText={portalCopy.namePronunciation.helperText}
                inputProps={{ maxLength: 200 }}
              />
              <MentorGroupField />
              <TextField
                label="微信号"
                value={form.wechat_number ?? ""}
                onChange={(e) => set("wechat_number", e.target.value)}
                fullWidth
                placeholder="方便导师或学员与你联系"
              />
              <TextField
                id="mentor-bio"
                label={isMentor ? <RequiredLabel text="一句话简介" /> : "一句话简介"}
                error={tried && isMentor && !filled(form.bio)}
                helperText={tried && isMentor && !filled(form.bio) ? portalCopy.requiredFieldError : undefined}
                value={form.bio ?? ""}
                onChange={(e) => set("bio", e.target.value)}
                fullWidth
                multiline
                minRows={2}
              />
              <TextField
                id="mentor-field"
                label={isMentor ? <RequiredLabel text="领域" /> : "领域"}
                error={tried && isMentor && !filled(form.field)}
                helperText={tried && isMentor && !filled(form.field) ? portalCopy.requiredFieldError : undefined}
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
                    id="mentor-can-help"
                    label={<RequiredLabel text={portalCopy.mentorQa.canHelpLabel} />}
                    error={tried && !filled(form.can_help)}
                    helperText={tried && !filled(form.can_help) ? portalCopy.mentorQa.requiredError : undefined}
                    value={form.can_help ?? ""}
                    onChange={(e) => set("can_help", e.target.value)}
                    fullWidth
                    multiline
                    minRows={6}
                    placeholder={portalCopy.mentorQa.canHelpPlaceholder}
                    InputLabelProps={{ shrink: true }}
                    sx={exampleSx}
                    inputProps={{ maxLength: 1500 }}
                  />
                  <TextField
                    id="mentor-capacity"
                    label={<RequiredLabel text="可以帮助的 mentee 数量" />}
                    error={tried && isMentor && !filled(form.mentee_capacity)}
                    helperText={tried && isMentor && !filled(form.mentee_capacity) ? portalCopy.requiredFieldError : undefined}
                    value={form.mentee_capacity ?? ""}
                    onChange={(e) => set("mentee_capacity", e.target.value)}
                    fullWidth
                    placeholder="可以提供大致范围，例如：2–3 名"
                  />
                  <TextField
                    id="mentor-expectations"
                    label={<RequiredLabel text="对 mentee 的期望" />}
                    error={tried && isMentor && !filled(form.mentee_expectations)}
                    helperText={tried && isMentor && !filled(form.mentee_expectations) ? portalCopy.requiredFieldError : undefined}
                    value={form.mentee_expectations ?? ""}
                    onChange={(e) => set("mentee_expectations", e.target.value)}
                    fullWidth
                    multiline
                    minRows={2}
                  />
                  <TextField
                    id="mentor-topics"
                    label={<RequiredLabel text="擅长与不擅长的话题" />}
                    error={tried && isMentor && !filled(form.topics)}
                    helperText={tried && isMentor && !filled(form.topics) ? portalCopy.requiredFieldError : undefined}
                    value={form.topics ?? ""}
                    onChange={(e) => set("topics", e.target.value)}
                    fullWidth
                    multiline
                    minRows={2}
                    placeholder="例如：擅长产品面试；不太擅长算法"
                  />
                  <Box sx={{ pt: 2 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                      <Typography variant="h6" fontWeight={700}>
                        {portalCopy.mentorQa.sectionTitle}
                      </Typography>
                      <RequiredTag />
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                      {portalCopy.mentorQa.sectionHelp}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8, mt: 1 }}>
                      {portalCopy.mentorQa.carryOverNote}
                    </Typography>
                  </Box>
                  <TextField
                    id="qa-intro"
                    error={tried && qaMissing}
                    helperText={tried && qaMissing ? portalCopy.mentorQa.requiredError : undefined}
                    label={portalCopy.mentorQa.introLabel}
                    value={form.qa_intro ?? ""}
                    onChange={(e) => set("qa_intro", e.target.value)}
                    fullWidth
                    multiline
                    minRows={7}
                    placeholder={portalCopy.mentorQa.introPlaceholder}
                    // Keep the label above the box so the example is visible while empty.
                    InputLabelProps={{ shrink: true }}
                    sx={exampleSx}
                    inputProps={{ maxLength: 2000 }}
                  />
                  <TextField
                    id="qa-topic"
                    error={tried && qaTopicMissing}
                    helperText={
                      tried && qaTopicMissing
                        ? portalCopy.mentorQa.requiredError
                        : portalCopy.mentorQa.topicHelp
                    }
                    label={portalCopy.mentorQa.topicLabel}
                    value={form.qa_topic ?? ""}
                    onChange={(e) => set("qa_topic", e.target.value)}
                    fullWidth
                    multiline
                    minRows={5}
                    placeholder={portalCopy.mentorQa.topicPlaceholder}
                    InputLabelProps={{ shrink: true }}
                    sx={exampleSx}
                    inputProps={{ maxLength: 1000 }}
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
                  disabled={mutation.isPending || avatarMutation.isPending}
                >
                  保存资料
                </Button>
              </Box>
            </Stack>
          </Paper>
        </Grid>
        {/* The volunteer record hangs off the real account, whichever persona
            is being previewed. */}
        {realUser && (
          <Grid size={{ xs: 12, md: 8 }}>
            <MyVolunteerSection
              profileId={realUser.id}
              isVolunteer={realUser.is_volunteer}
              onSaved={completeProfileTasks}
            />
          </Grid>
        )}
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
