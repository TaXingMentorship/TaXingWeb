"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

/**
 * Chart colours: the validated categorical order of the dataviz reference
 * palette (adjacent pairs pass the colour-blind separation check). Slot 1 is
 * Mentor everywhere and slot 2 is Mentee, so a colour keeps its meaning across
 * cards. Values and labels stay in text colours; only marks use these.
 */
export const VIZ = {
  series: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#6250d6"],
  other: "#9a978f",
  track: "#ece9e2",
} as const;

/**
 * One colour = one meaning, everywhere on the page:
 *   Mentor / Mentee / 志愿者 identify people and are used ONLY for them;
 *   TOTAL_COLOR (neutral ink) is "everyone" (the overall rate, the total tile);
 *   ACTIVITY_COLOR is sessions and posts, not people.
 * Warnings use the amber status colour, never a role colour.
 */
export const MENTOR_COLOR = VIZ.series[0];
export const MENTEE_COLOR = VIZ.series[1];
export const VOLUNTEER_COLOR = VIZ.series[2];
export const ACTIVITY_COLOR = VIZ.series[5];
export const TOTAL_COLOR = "#52514e";

/** `n` steps of the volunteer green, dark to light, for the groups inside the 志愿者 donut. */
export function volunteerRamp(n: number): string[] {
  const from = [0x0f, 0x7a, 0x55];
  const to = [0xb6, 0xe8, 0xd2];
  return Array.from({ length: n }, (_, i) => {
    const t = n <= 1 ? 0.35 : i / (n - 1);
    return (
      "#" +
      from
        .map((c, k) => Math.round(c + (to[k] - c) * t).toString(16).padStart(2, "0"))
        .join("")
    );
  });
}

export function percent(value: number, total: number): string {
  return total > 0 ? `${Math.round((value / total) * 100)}%` : "—";
}

/** Dark ink on light fills, white on dark ones, so a printed value stays legible. */
function inkOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const lum = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return lum > 0.3 ? "#1b1b1a" : "#ffffff";
}

export type DonutSlice = { label: string; value: number; color: string };

/**
 * A ring chart drawn as SVG stroke segments. `children` sits in the hole
 * (the headline number). Every slice carries a tooltip; a 0-value slice is
 * skipped. With no slices (or a zero total) only the track is drawn.
 */
export function Donut({
  slices,
  size = 160,
  thickness = 16,
  showValues = false,
  max,
  children,
  ariaLabel,
}: {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
  /** Print each slice's value on its arc (skipped for slivers under 6%). */
  showValues?: boolean;
  /** The value a full ring stands for. Omit for a part-to-whole ring; set it for a single progress slice. */
  max?: number;
  children?: React.ReactNode;
  ariaLabel: string;
}) {
  const r = 50 - thickness / 2;
  const c = 2 * Math.PI * r;
  const total = Math.max(max ?? 0, slices.reduce((sum, s) => sum + s.value, 0));
  const visible = slices.filter((s) => s.value > 0);
  const gap = visible.length > 1 ? 1.2 : 0;
  let offset = 0;
  const labels: { key: string; x: number; y: number; text: string; fill: string }[] = [];
  return (
    <Box
      sx={{ position: "relative", width: size, height: size, flexShrink: 0 }}
      role="img"
      aria-label={ariaLabel}
    >
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <circle cx="50" cy="50" r={r} fill="none" stroke={VIZ.track} strokeWidth={thickness} />
        {total > 0 &&
          visible.map((s, i) => {
            const len = (s.value / total) * c;
            const dash = Math.max(0, len - gap);
            const el = (
              <Tooltip
                key={i}
                title={`${s.label}：${s.value}（${percent(s.value, total)}）`}
                arrow
                placement="top"
              >
                <circle
                  cx="50"
                  cy="50"
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={thickness}
                  strokeDasharray={`${dash} ${c - dash}`}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 50 50)"
                  style={{ cursor: "default" }}
                />
              </Tooltip>
            );
            if (showValues && len / c >= 0.06) {
              const mid = ((offset + len / 2) / c) * 2 * Math.PI - Math.PI / 2;
              labels.push({
                key: String(i),
                x: 50 + r * Math.cos(mid),
                y: 50 + r * Math.sin(mid),
                text: String(s.value),
                fill: inkOn(s.color),
              });
            }
            offset += len;
            return el;
          })}
        {labels.map((l) => (
          <text
            key={l.key}
            x={l.x}
            y={l.y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={Math.min(thickness * 0.5, 9)}
            fontWeight={800}
            fill={l.fill}
            style={{ pointerEvents: "none" }}
          >
            {l.text}
          </text>
        ))}
      </svg>
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          pointerEvents: "none",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

/** Legend row: swatch + name on the left, figure on the right. */
export function LegendRow({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.25 }}>
      <Box sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: color, flexShrink: 0 }} />
      <Typography variant="body2">{label}</Typography>
      <Typography variant="body2" fontWeight={800} sx={{ ml: 0.5 }}>
        {value}
      </Typography>
    </Box>
  );
}

/** A small labelled figure: caption on top, the number big. `accent` tints the highlighted one. */
export function FigureCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  accent?: string;
}) {
  return (
    <Box
      sx={{
        px: 1.25,
        py: 0.75,
        borderRadius: 3,
        bgcolor: "action.hover",
        borderLeft: accent ? `4px solid ${accent}` : "4px solid transparent",
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 26, fontWeight: 800, lineHeight: 1.15 }}>{value}</Typography>
    </Box>
  );
}

/** A titled card; every dashboard block uses the same frame. */
export function DashCard({
  title,
  insight,
  hint,
  aside,
  icon,
  children,
  sx,
}: {
  title: string;
  /** The takeaway of the card, in one sentence. */
  insight?: string;
  hint?: string;
  /** Sits on the title line, pushed to the right. */
  aside?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  sx?: object;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 1.5, sm: 2 },
        borderRadius: 4,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        ...sx,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        {icon}
        <Typography variant="subtitle1" fontWeight={700}>
          {title}
        </Typography>
        {aside ? (
          <Typography variant="body2" color="text.secondary" sx={{ ml: "auto" }}>
            {aside}
          </Typography>
        ) : null}
      </Box>
      {insight ? (
        <Typography variant="body2" fontWeight={700} sx={{ mt: 0.25 }}>
          {insight}
        </Typography>
      ) : null}
      {hint ? (
        <Typography variant="caption" color="text.secondary" component="p">
          {hint}
        </Typography>
      ) : null}
      <Box sx={{ mt: 1.5, flexGrow: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        {children}
      </Box>
    </Paper>
  );
}

/** A headline number with a coloured icon chip. */
export function StatTile({
  label,
  value,
  note,
  icon,
  color,
}: {
  label: string;
  value: React.ReactNode;
  note?: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{ p: 1.5, borderRadius: 4, display: "flex", alignItems: "center", gap: 1.5 }}
    >
      <Box
        sx={{
          width: 44,
          height: 44,
          borderRadius: 3,
          bgcolor: color,
          color: "#fff",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h4" fontWeight={800} sx={{ lineHeight: 1.15 }}>
          {value}
        </Typography>
        {note ? (
          <Typography variant="caption" color="text.secondary">
            {note}
          </Typography>
        ) : null}
      </Box>
    </Paper>
  );
}

/** A session total with an icon chip: the number is the point, so it is big. */
export function CountTile({
  label,
  value,
  unit,
  icon,
  color,
  note,
}: {
  label: string;
  value: number;
  unit: string;
  icon: React.ReactNode;
  color: string;
  note?: string;
}) {
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 3,
        bgcolor: "action.hover",
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        minWidth: 0,
      }}
    >
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: 3,
          bgcolor: color,
          color: "#fff",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5 }}>
          <Typography sx={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1 }}>{value}</Typography>
          <Typography variant="body2" color="text.secondary">
            {unit}
          </Typography>
        </Box>
        {note ? (
          <Typography variant="caption" color="text.secondary">
            {note}
          </Typography>
        ) : null}
      </Box>
    </Box>
  );
}
