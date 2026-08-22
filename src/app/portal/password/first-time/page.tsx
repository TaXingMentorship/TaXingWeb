"use client";

import * as React from "react";
import Link from "next/link";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { createClient } from "@/lib/supabase/client";

export default function FirstTimePasswordPage() {
  const supabase = React.useMemo(() => createClient(), []);
  const [email, setEmail] = React.useState("");
  const [activationCode, setActivationCode] = React.useState("");
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

    const response = await fetch("/api/auth/first-time", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, activationCode, password }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(payload?.error ?? "暂时无法激活账号，请稍后重试。");
      setSubmitting(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) {
      setError("账号已激活，请返回登录页面使用新密码登录。");
      setSubmitting(false);
      return;
    }
    window.location.assign("/portal/onboarding");
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
        <Stack spacing={3}>
          <Box>
            <Typography variant="h4" fontWeight={800} color="secondary.main">
              激活会员账号
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              使用受邀邮箱和管理员提供的激活码，然后设置你的私人密码。
            </Typography>
          </Box>

          {error && <Alert severity="error">{error}</Alert>}
          <Box component="form" onSubmit={handleSubmit}>
            <Stack spacing={2}>
              <TextField
                label="受邀邮箱"
                type="email"
                autoComplete="email"
                required
                fullWidth
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={submitting}
              />
              <TextField
                label="共享激活码"
                type="password"
                autoComplete="off"
                required
                fullWidth
                value={activationCode}
                onChange={(event) => setActivationCode(event.target.value)}
                disabled={submitting}
                inputProps={{ minLength: 12 }}
              />
              <TextField
                label="设置私人密码"
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
                label="确认私人密码"
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
                  "激活并进入会员门户"
                )}
              </Button>
            </Stack>
          </Box>

          <Button component={Link} href="/portal/login">
            返回登录
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
