"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ButtonBase from "@mui/material/ButtonBase";
import { keyframes } from "@mui/material/styles";
import { portalCopy } from "@/data/portalCopy";
import { MASCOT_FEEDBACK_HREF } from "@/data/mascot";
import MascotHat from "@/components/portal/MascotHat";
import { useMyTasks } from "@/components/portal/useMyTasks";

const { mascot: copy } = portalCopy;

const GREETED_KEY = "mascot:greetedAt";
const COLLAPSED_KEY = "mascot:collapsed";
const GREETING_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const GREETING_DELAY_MS = 3500;
const GREETING_VISIBLE_MS = 7000;

// Body and lantern are separate layers cut from one illustration, so they
// register by stacking. The body bobs; the lantern swings from the hand.
const bob = keyframes`
  0%, 100% { transform: translateY(0) rotate(-1deg); }
  50% { transform: translateY(-7px) rotate(1deg); }
`;
const swing = keyframes`
  0%, 100% { transform: rotate(-4deg); }
  50% { transform: rotate(3deg); }
`;
const glow = keyframes`
  0%, 100% { filter: drop-shadow(0 0 3px rgba(255, 214, 51, 0.55)); }
  50% { filter: drop-shadow(0 0 11px rgba(255, 214, 51, 0.95)); }
`;

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Private mode / blocked storage: the mascot just forgets between visits.
  }
}

export default function MascotFeedback() {
  const { pending } = useMyTasks();
  const pendingIds = React.useMemo(() => pending.map((item) => item.id), [pending]);
  const [open, setOpen] = React.useState(false);
  const [greeting, setGreeting] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);

  React.useEffect(() => {
    if (readStorage(COLLAPSED_KEY) === "1") {
      setCollapsed(true);
      return;
    }
    const last = Number(readStorage(GREETED_KEY) ?? 0);
    if (Date.now() - last < GREETING_COOLDOWN_MS) return;
    const show = window.setTimeout(() => {
      setGreeting(true);
      writeStorage(GREETED_KEY, String(Date.now()));
    }, GREETING_DELAY_MS);
    const hide = window.setTimeout(
      () => setGreeting(false),
      GREETING_DELAY_MS + GREETING_VISIBLE_MS,
    );
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, []);

  const collapse = () => {
    setOpen(false);
    setGreeting(false);
    setCollapsed(true);
    writeStorage(COLLAPSED_KEY, "1");
  };
  const expand = () => {
    setCollapsed(false);
    writeStorage(COLLAPSED_KEY, null);
  };

  const size = { xs: 84, sm: 112 };

  return (
    <Box
      sx={{
        position: "fixed",
        right: { xs: 12, sm: 24 },
        bottom: { xs: 12, sm: 20 },
        zIndex: 1200,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 1,
        pointerEvents: "none",
        "& > *": { pointerEvents: "auto" },
      }}
    >
      {!collapsed && (open || greeting) && (
        <Paper
          role="dialog"
          aria-label={copy.ariaLabel}
          elevation={6}
          sx={{
            position: "relative",
            maxWidth: 252,
            p: 2,
            borderRadius: 3,
            border: "2px solid",
            borderColor: "warning.light",
            // speech-bubble tail pointing at the mascot
            "&::after": {
              content: '""',
              position: "absolute",
              right: 36,
              bottom: -9,
              width: 14,
              height: 14,
              bgcolor: "background.paper",
              borderRight: "2px solid",
              borderBottom: "2px solid",
              borderColor: "warning.light",
              transform: "rotate(45deg)",
            },
          }}
        >
          {open ? (
            <>
              <Typography fontWeight={800} gutterBottom>
                {copy.bubbleTitle}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                {copy.bubbleBody}
              </Typography>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 1.5 }}>
                {pending.length > 0 ? (
                  <>
                    {copy.tasksLeft(pending.length)}{" "}
                    <Link href="/portal/tasks" onClick={() => setOpen(false)}>
                      {copy.tasksLink}
                    </Link>
                  </>
                ) : (
                  copy.tasksDone
                )}
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button
                  component={Link}
                  href={MASCOT_FEEDBACK_HREF}
                  size="small"
                  variant="contained"
                  color="warning"
                  onClick={() => setOpen(false)}
                >
                  {copy.feedbackAction}
                </Button>
                <Button size="small" onClick={() => setOpen(false)}>
                  {copy.later}
                </Button>
                <Button size="small" color="inherit" onClick={collapse}>
                  {copy.hide}
                </Button>
              </Stack>
            </>
          ) : (
            <Typography variant="body2">{copy.greeting}</Typography>
          )}
        </Paper>
      )}

      <ButtonBase
        onClick={collapsed ? expand : () => setOpen((v) => !v)}
        aria-label={collapsed ? copy.show : copy.ariaLabel}
        aria-expanded={collapsed ? undefined : open}
        sx={{
          width: size,
          aspectRatio: "830 / 887",
          position: "relative",
          borderRadius: 4,
          // Collapsed: tuck most of her off the screen edge, leaving a peek.
          transform: collapsed ? "translateX(62%)" : "none",
          opacity: collapsed ? 0.9 : 1,
          transition: "transform 0.35s ease, opacity 0.35s ease",
          "&:hover": { transform: collapsed ? "translateX(40%)" : "scale(1.06)" },
          "&:focus-visible": { outline: "3px solid", outlineColor: "warning.main" },
          "@media (prefers-reduced-motion: reduce)": {
            "&, & *": { animation: "none !important", transition: "none !important" },
          },
        }}
      >
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            animation: `${bob} 3.8s ease-in-out infinite`,
          }}
        >
          <Image
            src="/images/mascot/body.webp"
            alt=""
            fill
            sizes="112px"
            priority={false}
            draggable={false}
          />
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              transformOrigin: "21% 46%",
              animation: `${swing} 3.1s ease-in-out infinite, ${glow} 2.6s ease-in-out infinite`,
            }}
          >
            <Image
              src="/images/mascot/lantern.webp"
              alt=""
              fill
              sizes="112px"
              draggable={false}
            />
          </Box>
          <MascotHat taskIds={pendingIds} />
        </Box>
      </ButtonBase>
    </Box>
  );
}
