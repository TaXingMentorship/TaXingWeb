"use client";

import * as React from "react";
import Link from "next/link";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { createClient } from "@/lib/supabase/client";

function safeNextPath(value: string | null) {
  return value?.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\")
    ? value
    : "/portal";
}

export default function PortalLoginPage() {
  const supabase = React.useMemo(() => createClient(), []);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) {
      setError("邮箱或密码不正确。首次登录请先使用邀请邮件设置密码。");
      setSubmitting(false);
      return;
    }

    window.location.assign(
      safeNextPath(new URLSearchParams(window.location.search).get("next")),
    );
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
              她行 · Mentorship
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              使用受邀邮箱和密码登录会员门户。
            </Typography>
          </Box>
          {error && <Alert severity="error">{error}</Alert>}
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
              <TextField
                label="密码"
                type="password"
                autoComplete="current-password"
                required
                fullWidth
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={submitting}
              />
              <Button
                component={Link}
                href="/portal/password/forgot"
                size="small"
                sx={{ alignSelf: "flex-end" }}
              >
                忘记密码？
              </Button>
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={submitting}
              >
                {submitting ? "登录中…" : "登录"}
              </Button>
            </Stack>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}
