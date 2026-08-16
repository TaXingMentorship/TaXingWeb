"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { createClient } from "@/lib/supabase/client";

export default function PasswordForm({ mode }: { mode: "setup" | "update" }) {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const [password, setPassword] = React.useState("");
  const [confirmation, setConfirmation] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("密码至少需要 8 个字符。");
      return;
    }
    if (password !== confirmation) {
      setError("两次输入的密码不一致。");
      return;
    }

    setSubmitting(true);
    const timeout = new Promise<never>((_, reject) => {
      window.setTimeout(
        () => reject(new Error("PASSWORD_UPDATE_TIMEOUT")),
        15_000,
      );
    });
    let updateError: Error | null = null;
    try {
      const result = await Promise.race([
        supabase.auth.updateUser({ password }),
        timeout,
      ]);
      updateError = result.error;
    } catch {
      setError("保存密码超时，请刷新页面并使用最新的重置链接重试。");
      setSubmitting(false);
      return;
    }
    if (updateError) {
      setError("无法保存密码。链接可能已过期，请重新申请。");
      setSubmitting(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/portal/login");
      router.refresh();
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) {
      setError("密码已保存，但暂时无法读取会员资料。请重新登录。");
      setSubmitting(false);
      return;
    }

    router.replace(profile ? "/portal" : "/portal/onboarding");
    router.refresh();
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
      <Paper elevation={3} sx={{ width: "100%", maxWidth: 440, p: 4 }}>
        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={3}>
            <Box>
              <Typography variant="h4" fontWeight={800} color="secondary.main">
                {mode === "setup" ? "设置登录密码" : "更新登录密码"}
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                密码至少 8 个字符。设置后可直接使用邮箱和密码登录。
              </Typography>
            </Box>

            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="新密码"
              type="password"
              autoComplete="new-password"
              required
              fullWidth
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={submitting}
              inputProps={{ minLength: 8 }}
            />
            <TextField
              label="确认新密码"
              type="password"
              autoComplete="new-password"
              required
              fullWidth
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              disabled={submitting}
              inputProps={{ minLength: 8 }}
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={submitting}
            >
              {submitting ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                "保存密码"
              )}
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}
