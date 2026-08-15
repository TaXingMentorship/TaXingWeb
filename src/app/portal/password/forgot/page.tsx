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

export default function ForgotPasswordPage() {
  const supabase = React.useMemo(() => createClient(), []);
  const [email, setEmail] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const callbackUrl = new URL("/portal/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("next", "/portal/password/update");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: callbackUrl.toString() },
    );

    if (resetError) {
      setError("暂时无法发送重置邮件，请稍后重试。");
    } else {
      setSent(true);
    }
    setSubmitting(false);
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
              重置密码
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              我们会向你的受邀邮箱发送一次性重置链接。
            </Typography>
          </Box>

          {error && <Alert severity="error">{error}</Alert>}
          {sent ? (
            <Alert severity="success">
              如果该邮箱已受邀，重置邮件会很快送达。请使用最新邮件。
            </Alert>
          ) : (
            <Box component="form" onSubmit={handleSubmit}>
              <Stack spacing={2}>
                <TextField
                  label="邮箱"
                  type="email"
                  autoComplete="email"
                  required
                  fullWidth
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={submitting}
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
                    "发送重置邮件"
                  )}
                </Button>
              </Stack>
            </Box>
          )}

          <Button component={Link} href="/portal/login">
            返回登录
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
