"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import { keyframes } from "@mui/material/styles";
import { MASCOT_HATS, MASCOT_HAT_MAX, seasonOf } from "@/data/mascot";

/**
 * Seasonal hat: one piece (a Japanese-maple leaf in autumn) per unfinished
 * task, circling her. A task that gets done drifts down and fades; a new one
 * grows in. Pieces keep their slot so the others don't shuffle.
 */

const LEAF_PATH =
  "M17.5 69.7 L37.1 62.5 L19.7 50.9 L40 55.7 L28 30.6 L46.3 51.6 L49.9 20 L53.7 51.5 L71.9 30.5 L59.9 55.6 L80.3 50.8 L62.9 62.4 L82.5 69.6 L50 72 Z";
const LEAF_VEINS =
  "M50 64 L24 68.6 M50 64 L25.8 53.6 M50 64 L32.4 37.3 M50 64 L49.9 32 M50 64 L67.5 37.2 M50 64 L74.2 53.5 M50 64 L76 68.5";

const COLORS = [
  ["#c8321c", "#ee6a2a"],
  ["#d94a1e", "#f58a2e"],
  ["#b82a1a", "#e8552a"],
  ["#e0561f", "#f7a03a"],
  ["#c43a1c", "#f07a30"],
  ["#d03d1e", "#f2862f"],
] as const;

/** Leaf width as a share of the mascot's width. */
const LEAF_SIZE = 32;

const FALL_MS = 2200;
const ORBIT_S = 14;

const float = keyframes`
  0%, 100% { transform: translateY(0) rotate(var(--tilt-a)); }
  50% { transform: translateY(-4px) rotate(var(--tilt-b)); }
`;
const grow = keyframes`
  0% { transform: scale(0) translateY(10px); opacity: 0; }
  70% { transform: scale(1.15); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
`;
// Elliptical lap around the body; scale fakes depth (front bigger).
const orbit = keyframes`
  0% { left: 50%; top: 82%; transform: scale(1.15); }
  12.5% { left: 82%; top: 70%; transform: scale(1); }
  25% { left: 104%; top: 48%; transform: scale(0.85); }
  37.5% { left: 82%; top: 20%; transform: scale(0.75); }
  50% { left: 50%; top: 8%; transform: scale(0.7); }
  62.5% { left: 18%; top: 20%; transform: scale(0.75); }
  75% { left: -4%; top: 48%; transform: scale(0.85); }
  87.5% { left: 18%; top: 70%; transform: scale(1); }
  100% { left: 50%; top: 82%; transform: scale(1.15); }
`;
// Drops away, swaying side to side like a real leaf.
const fall = keyframes`
  0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
  20% { transform: translate(-14px, 24px) rotate(-35deg); opacity: 1; }
  45% { transform: translate(12px, 62px) rotate(30deg); opacity: 1; }
  70% { transform: translate(-10px, 110px) rotate(-50deg); opacity: 0.8; }
  100% { transform: translate(8px, 170px) rotate(25deg); opacity: 0; }
`;

type Leaf = { id: string; slot: number; falling: boolean };

function Maple({ colors, id }: { colors: readonly [string, string]; id: string }) {
  const [from, to] = colors;
  const gradient = `maple-${id}`;
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden>
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={to} />
          <stop offset="1" stopColor={from} />
        </linearGradient>
      </defs>
      <path d="M50 72 Q51 84 47 94" stroke="#8a4a1f" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d={LEAF_PATH} fill={`url(#${gradient})`} stroke="#a4301a" strokeWidth="3" strokeLinejoin="round" />
      <path d={LEAF_VEINS} stroke="#ffd9a0" strokeOpacity="0.7" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export default function MascotHat({ taskIds }: { taskIds: string[] }) {
  const hat = MASCOT_HATS[seasonOf()];
  const [leaves, setLeaves] = React.useState<Leaf[]>([]);
  const key = taskIds.slice(0, MASCOT_HAT_MAX).join(",");

  React.useEffect(() => {
    const wanted = key ? key.split(",") : [];
    setLeaves((prev) => {
      const keep = new Set(wanted);
      const next = prev.map((leaf) =>
        keep.has(leaf.id)
          ? { ...leaf, falling: false }
          : leaf.falling
            ? leaf
            : { ...leaf, falling: true },
      );
      const used = new Set(next.map((leaf) => leaf.slot));
      for (const id of wanted) {
        if (next.some((leaf) => leaf.id === id)) continue;
        const slot = COLORS.findIndex((_, index) => !used.has(index));
        if (slot === -1) break;
        used.add(slot);
        next.push({ id, slot, falling: false });
      }
      return next;
    });
  }, [key]);

  // Timer rather than onAnimationEnd, so reduced-motion (no animation) still
  // clears the fallen leaves.
  React.useEffect(() => {
    if (!leaves.some((leaf) => leaf.falling)) return;
    const timer = window.setTimeout(
      () => setLeaves((prev) => prev.filter((leaf) => !leaf.falling)),
      FALL_MS,
    );
    return () => window.clearTimeout(timer);
  }, [leaves]);

  if (!hat) return null;

  return (
    <Box sx={{ position: "absolute", inset: 0, pointerEvents: "none" }} aria-hidden>
      {leaves.map((leaf) => {
        const n = leaf.slot + 1;
        return (
          <Box
            key={leaf.id}
            sx={{
              position: "absolute",
              width: `${LEAF_SIZE}%`,
              aspectRatio: "1",
              ml: `${-LEAF_SIZE / 2}%`,
              mt: `${-LEAF_SIZE / 2}%`,
              // Falling leaves keep orbiting while they drop, so they don't jump.
              animation: `${orbit} ${ORBIT_S}s linear ${-(leaf.slot / COLORS.length) * ORBIT_S}s infinite`,
            }}
          >
            <Box
              sx={{
                width: "100%",
                height: "100%",
                "--tilt-a": `${-18 - n * 4}deg`,
                "--tilt-b": `${18 + n * 4}deg`,
                filter: "drop-shadow(0 2px 2px rgba(120, 40, 10, 0.3))",
                animation: leaf.falling
                  ? `${fall} ${FALL_MS}ms ease-in forwards`
                  : `${grow} 0.7s ease-out both, ${float} ${2.4 + n * 0.35}s ease-in-out ${0.7 + n * 0.2}s infinite`,
              }}
            >
              <Maple colors={COLORS[leaf.slot]} id={leaf.id} />
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
