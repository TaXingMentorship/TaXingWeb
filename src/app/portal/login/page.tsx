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
import SecretVisibilityToggle from "@/components/portal/SecretVisibilityToggle";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { safePortalNextPath } from "@/lib/portal/safeNextPath";

export default function PortalLoginPage() {
  const supabase = React.useMemo(() => createClient(), []);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [passwordVisible, setPasswordVisible] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const nextPath = React.useCallback(
    () =>
      safePortalNextPath(
        new URLSearchParams(window.location.search).get("next"),
        window.location.origin,
      ),
    [],
  );

  // Already signed in (for instance bounced back here by a failed navigation):
  // go straight on instead of showing the form again.
  React.useEffect(() => {
    let cancelled = false;
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (user && !cancelled) window.location.replace(nextPath());
    });
    return () => {
      cancelled = true;
    };
  }, [supabase, nextPath]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) {
      // Only a rejected credential means "wrong email or password"; a failed
      // request or a rate limit says nothing about what the user typed.
      setError(
        signInError.code === "invalid_credentials"
          ? "邮箱或密码不正确。首次登录请先设置密码。"
          : isAuthRetryableFetchError(signInError)
            ? "无法连接到服务器，请检查网络后重试。"
            : "登录失败，请稍后重试。",
      );
      setSubmitting(false);
      return;
    }

    // Full navigation, so the portal layout re-reads the new session.
    // replace() keeps the login page out of the back-button history.
    window.location.replace(nextPath());
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
                type={passwordVisible ? "text" : "password"}
                autoComplete="current-password"
                required
                fullWidth
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={submitting}
                InputProps={{
                  endAdornment: (
                    <SecretVisibilityToggle
                      visible={passwordVisible}
                      onToggle={() => setPasswordVisible((visible) => !visible)}
                      name="密码"
                    />
                  ),
                }}
              />
              <Stack direction="row" justifyContent="space-between">
                <Button
                  component={Link}
                  href="/portal/password/first-time"
                  size="small"
                >
                  首次登录？激活账号
                </Button>
                <Button
                  component={Link}
                  href="/portal/password/forgot"
                  size="small"
                >
                  忘记密码？
                </Button>
              </Stack>
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
