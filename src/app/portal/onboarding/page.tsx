"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { roleLabels } from "@/data/portalCopy";
import { usePortalSession } from "@/components/portal/PortalSessionProvider";
import {
  AVATAR_MAX_BYTES,
  IMAGE_ACCEPT,
  uploadAvatar,
  validateImageFile,
} from "@/lib/portal/uploads";
import type { UserRole } from "@/types/portal";

type Invite = {
  fullName: string | null;
  role: UserRole;
  cohortIds: string[];
  cohortNames: string[];
};

async function responseError(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return payload?.error ?? "请求失败，请稍后重试。";
}

export default function OnboardingPage() {
  const router = useRouter();
  const { authUser, refresh } = usePortalSession();
  const [invite, setInvite] = React.useState<Invite | null>(null);
  const [fullName, setFullName] = React.useState("");
  const [wechatNumber, setWechatNumber] = React.useState("");
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;

    void fetch("/api/onboarding", { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response));
        return response.json() as Promise<{ invite: Invite }>;
      })
      .then(({ invite: loadedInvite }) => {
        if (!active) return;
        setInvite(loadedInvite);
        setFullName(loadedInvite.fullName ?? "");
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error ? loadError.message : "无法读取邀请信息。",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleAvatar(file: File | undefined) {
    if (!file || !authUser) return;
    const validationError = validateImageFile(file, AVATAR_MAX_BYTES);
    if (validationError) {
      setError(validationError);
      return;
    }

    setUploading(true);
    setError(null);
    try {
      setAvatarUrl(await uploadAvatar(authUser.id, file));
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "头像上传失败。",
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          wechatNumber: wechatNumber || null,
          avatarUrl,
        }),
      });
      if (!response.ok) throw new Error(await responseError(response));

      await refresh();
      router.replace("/portal");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "注册失败。",
      );
      setSubmitting(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: "calc(100vh - 64px)",
        display: "grid",
        placeItems: "center",
        px: 2,
        py: 6,
      }}
    >
      <Paper elevation={3} sx={{ width: "100%", maxWidth: 520, p: 4 }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box component="form" onSubmit={handleSubmit}>
            <Stack spacing={3}>
              <Box>
                <Typography variant="h4" fontWeight={800} color="secondary.main">
                  完善会员资料
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  使用受邀信息创建你的会员档案。
                </Typography>
              </Box>

              {error && <Alert severity="error">{error}</Alert>}

              {invite && (
                <Alert severity="info">
                  身份：{roleLabels[invite.role]}
                  {invite.cohortNames.length > 0
                    ? ` · 项目：${invite.cohortNames.join("、")}`
                    : ""}
                </Alert>
              )}

              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar src={avatarUrl ?? undefined} sx={{ width: 72, height: 72 }} />
                <Button
                  component="label"
                  variant="outlined"
                  startIcon={<UploadFileIcon />}
                  disabled={!authUser || uploading}
                >
                  {uploading ? "上传中…" : "上传头像"}
                  <input
                    type="file"
                    accept={IMAGE_ACCEPT}
                    hidden
                    onChange={(event) => {
                      void handleAvatar(event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                </Button>
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ mt: "-16px !important" }}>
                JPEG、PNG 或 WebP，最大 2 MB
              </Typography>

              <TextField
                label="姓名"
                required
                fullWidth
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                inputProps={{ maxLength: 200 }}
              />
              <TextField
                label="微信号（选填）"
                fullWidth
                value={wechatNumber}
                onChange={(event) => setWechatNumber(event.target.value)}
                inputProps={{ maxLength: 100 }}
              />
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={
                  !invite || !fullName.trim() || uploading || submitting
                }
              >
                {submitting ? "创建中…" : "进入会员门户"}
              </Button>
            </Stack>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
