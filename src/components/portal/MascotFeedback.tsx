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
const OFFSET_KEY = "mascot:offset";
const GREETING_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const GREETING_DELAY_MS = 3500;
const GREETING_VISIBLE_MS = 7000;
/** Below this the gesture is still a click, not a drag. */
const DRAG_THRESHOLD_PX = 4;
/** Keeps her from being dropped flush against (or past) a viewport edge. */
const EDGE_MARGIN_PX = 8;

type Offset = { x: number; y: number };
/** Her resting spot: the bottom-right corner the layout already anchors. */
const HOME: Offset = { x: 0, y: 0 };

const isHome = (offset: Offset) => offset.x === 0 && offset.y === 0;

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

function parseOffset(raw: string | null): Offset | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Offset>;
    if (!Number.isFinite(parsed?.x) || !Number.isFinite(parsed?.y)) return null;
    return { x: Number(parsed.x), y: Number(parsed.y) };
  } catch {
    return null;
  }
}

export default function MascotFeedback() {
  const { pending } = useMyTasks();
  const pendingIds = React.useMemo(() => pending.map((item) => item.id), [pending]);
  const [open, setOpen] = React.useState(false);
  const [greeting, setGreeting] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);
  const [offset, setOffset] = React.useState<Offset>(HOME);
  const [dragging, setDragging] = React.useState(false);

  // The layout box excludes the button's collapsed and hover transforms.
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  // Mirrors `offset` so drag end and resize can read it without re-subscribing.
  const offsetRef = React.useRef<Offset>(HOME);
  const dragRef = React.useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  // A drag ends with a click event that must not toggle the bubble.
  const suppressClickRef = React.useRef(false);

  const applyOffset = React.useCallback((next: Offset) => {
    offsetRef.current = next;
    setOffset(next);
  }, []);

  /** Keeps the whole layout, including an open bubble, inside the viewport. */
  const clampOffset = React.useCallback(
    (candidate: Offset, base: Offset, rect: DOMRect): Offset => {
      const left = rect.left + (candidate.x - base.x);
      const top = rect.top + (candidate.y - base.y);
      const maxLeft = Math.max(window.innerWidth - rect.width - EDGE_MARGIN_PX, EDGE_MARGIN_PX);
      const maxTop = Math.max(window.innerHeight - rect.height - EDGE_MARGIN_PX, EDGE_MARGIN_PX);
      const clampedLeft = Math.min(Math.max(left, EDGE_MARGIN_PX), maxLeft);
      const clampedTop = Math.min(Math.max(top, EDGE_MARGIN_PX), maxTop);
      return {
        x: candidate.x + (clampedLeft - left),
        y: candidate.y + (clampedTop - top),
      };
    },
    [],
  );

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

  React.useEffect(() => {
    const stored = parseOffset(readStorage(OFFSET_KEY));
    if (!stored || isHome(stored)) return;
    const node = containerRef.current;
    // The window may have been resized since she was parked there. Her box is
    // still measured at HOME here, because the offset has not been applied yet.
    applyOffset(
      node ? clampOffset(stored, HOME, node.getBoundingClientRect()) : stored,
    );
  }, [applyOffset, clampOffset]);

  React.useLayoutEffect(() => {
    const onResize = () => {
      const node = containerRef.current;
      const current = offsetRef.current;
      if (!node || (isHome(current) && (collapsed || !(open || greeting)))) return;
      const next = clampOffset(current, current, node.getBoundingClientRect());
      if (next.x === current.x && next.y === current.y) return;
      applyOffset(next);
      writeStorage(OFFSET_KEY, JSON.stringify(next));
    };
    onResize();
    const observer = new ResizeObserver(onResize);
    if (containerRef.current) observer.observe(containerRef.current);
    window.addEventListener("resize", onResize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [applyOffset, clampOffset, collapsed, open, greeting]);

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

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || !event.isPrimary || dragRef.current) return;
    suppressClickRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.buttons === 0) {
      handlePointerEnd(event);
      return;
    }
    const node = containerRef.current;
    if (!node) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      drag.moved = true;
      setDragging(true);
    }
    const current = offsetRef.current;
    // The measured box reflects rendered state, not a pending pointer update.
    applyOffset(
      clampOffset(
        { x: current.x + dx, y: current.y + dy },
        offset,
        node.getBoundingClientRect(),
      ),
    );
    drag.startX = event.clientX;
    drag.startY = event.clientY;
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!drag.moved) return;
    setDragging(false);
    suppressClickRef.current = event.type === "pointerup";
    writeStorage(OFFSET_KEY, JSON.stringify(offsetRef.current));
  };

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    // The 2nd click of a double-click means "go home", not "toggle".
    if (event.detail > 1) return;
    if (collapsed) expand();
    else setOpen((v) => !v);
  };

  const handleDoubleClick = () => {
    if (isHome(offsetRef.current)) return;
    applyOffset(HOME);
    writeStorage(OFFSET_KEY, null);
    setDragging(false);
    // Undo the bubble toggle the first click of this gesture already did.
    setOpen(false);
  };

  const home = isHome(offset);
  const size = { xs: 84, sm: 112 };

  return (
    <Box
      ref={containerRef}
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
        // The bubble rides along so its tail keeps pointing at her.
        transform: home ? "none" : `translate3d(${offset.x}px, ${offset.y}px, 0)`,
      }}
    >
      {!collapsed && (open || greeting) && (
        <Paper
          role="dialog"
          aria-label={copy.ariaLabel}
          elevation={6}
          sx={{
            position: "relative",
            maxWidth: "min(252px, calc(100vw - 16px))",
            boxSizing: "border-box",
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
          <Box
            sx={{
              // Reserve the mascot, gap, paper padding and viewport margins.
              maxHeight: { xs: "calc(100dvh - 150px)", sm: "calc(100dvh - 180px)" },
              overflowY: "auto",
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
          </Box>
        </Paper>
      )}

      <ButtonBase
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onLostPointerCapture={handlePointerEnd}
        title={copy.dragHint}
        aria-label={collapsed ? copy.show : copy.ariaLabel}
        aria-expanded={collapsed ? undefined : open}
        sx={{
          width: size,
          aspectRatio: "830 / 887",
          position: "relative",
          borderRadius: 4,
          cursor: dragging ? "grabbing" : "grab",
          // Pointer drags must not also scroll the page on touch.
          touchAction: "none",
          // Collapsed: tuck most of her off the screen edge, leaving a peek.
          // Only at home, where there is an edge to tuck against.
          transform: collapsed && home && !dragging ? "translateX(62%)" : "none",
          opacity: collapsed ? 0.9 : 1,
          transition: dragging ? "none" : "transform 0.35s ease, opacity 0.35s ease",
          "&:hover": {
            transform: dragging ? "none" : collapsed && home ? "translateX(40%)" : "scale(1.06)",
          },
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
