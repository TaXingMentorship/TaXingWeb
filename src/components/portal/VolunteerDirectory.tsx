"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import AvatarGroup from "@mui/material/AvatarGroup";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import { alpha } from "@mui/material/styles";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import type {
  Profile,
  ResolvedVolunteerWithSeasons,
  VolunteerGroup,
} from "@/types/portal";
import { portalCopy } from "@/data/portalCopy";
import DirectoryCard, { type DirectoryBadge } from "./DirectoryCard";
import MemberAvatar from "./MemberAvatar";

/** Cards per row at most, and rows shown before 「+N」. */
const PER_ROW = 5;
const ROWS = 2;
const COLLAPSED_COUNT = PER_ROW * ROWS;

/** Cycled by group order, so a group keeps its colour while the list is stable. */
const GROUP_COLORS = ["#1565c0", "#2e7d32", "#6a1b9a", "#00838f", "#ad1457", "#5d4037"];
/** Theme token (`secondary`, the site orange) — resolved by `sx`, not a hex. */
const LEAD_COLOR = "secondary.main";
const UNGROUPED_COLOR = "#757575";

type Section = {
  key: string;
  title: string;
  hint?: string;
  color: string;
  members: { profile: Profile; badges: DirectoryBadge[]; lead?: boolean }[];
};

/**
 * The volunteer tab of the member directory for one season: leads first, then
 * one section per group. Group and lead live on `volunteer_seasons`, so every
 * answer is "in this season" — the same person can sit in a different group
 * next season.
 */
export default function VolunteerDirectory({
  profiles,
  volunteers,
  groups,
  cohortId,
  onSelect,
}: {
  profiles: Profile[];
  volunteers: ResolvedVolunteerWithSeasons[];
  groups: VolunteerGroup[];
  cohortId: string;
  onSelect: (profile: Profile) => void;
}) {
  const sections = React.useMemo<Section[]>(() => {
    const byProfile = new Map(
      volunteers.filter((v) => v.profile_id).map((v) => [v.profile_id!, v]),
    );
    const groupIndex = new Map(groups.map((g, i) => [g.id, i]));
    const groupName = new Map(groups.map((g) => [g.id, g.name]));
    const colorOf = (groupId: string | null) =>
      groupId && groupIndex.has(groupId)
        ? GROUP_COLORS[groupIndex.get(groupId)! % GROUP_COLORS.length]
        : UNGROUPED_COLOR;

    const perGroup = new Map<string, Section>(
      groups.map((g) => [
        g.id,
        {
          key: g.id,
          title: g.name,
          hint: g.description ?? undefined,
          color: colorOf(g.id),
          members: [],
        },
      ]),
    );
    const ungrouped: Section = {
      key: "none",
      title: "未分组",
      color: UNGROUPED_COLOR,
      members: [],
    };
    const leadBadge: DirectoryBadge = {
      label: "负责人",
      color: LEAD_COLOR,
      filled: true,
    };
    const leadEntries: Section["members"] = [];

    for (const profile of profiles) {
      const season = byProfile
        .get(profile.id)
        ?.seasons.find((s) => s.cohort_id === cohortId);
      const gName = season?.group_id ? groupName.get(season.group_id) : undefined;
      const color = colorOf(season?.group_id ?? null);
      const own = season?.group_id ? perGroup.get(season.group_id) : undefined;
      if (season?.is_lead && own) {
        // A lead heads their own group and, being a lead, also belongs to every
        // `includes_leads` group (战略组) — shown in both, never as a third list.
        own.members.push({
          profile,
          badges: [leadBadge, { label: gName!, color }],
          lead: true,
        });
        leadEntries.push({
          profile,
          badges: [leadBadge, { label: `${gName}`, color }],
          lead: true,
        });
      } else if (own) {
        own.members.push({ profile, badges: [{ label: gName!, color }] });
      } else {
        ungrouped.members.push({
          profile,
          badges: [{ label: "未分组", color: UNGROUPED_COLOR }],
        });
      }
    }

    for (const group of groups) {
      if (!group.includes_leads) continue;
      const section = perGroup.get(group.id)!;
      const present = new Set(section.members.map((m) => m.profile.id));
      section.members.push(
        ...leadEntries.filter((m) => !present.has(m.profile.id)),
      );
    }
    for (const section of perGroup.values()) {
      section.members.sort(
        (x, y) => Number(Boolean(y.lead)) - Number(Boolean(x.lead)),
      );
    }

    return [...perGroup.values(), ungrouped].filter(
      (s) => s.members.length > 0,
    );
  }, [profiles, volunteers, groups, cohortId]);

  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const copy = portalCopy.volunteerDirectory;

  return (
    <Stack spacing={4}>
      {sections.map((section) => {
        const open = expanded.has(section.key);
        const hidden = section.members.length - COLLAPSED_COUNT;
        const shown = open ? section.members : section.members.slice(0, COLLAPSED_COUNT);
        return (
        <Box key={section.key}>
          <Stack direction="row" spacing={1.5} alignItems="baseline" sx={{ mb: 1.5 }}>
            <Box
              sx={{ width: 6, height: 22, borderRadius: 1, bgcolor: section.color, alignSelf: "center" }}
            />
            <Typography variant="h6" fontWeight={800}>
              {section.title}（{section.members.length}）
            </Typography>
            {section.hint && (
              <Typography variant="body2" color="text.secondary">
                {section.hint}
              </Typography>
            )}
          </Stack>
          <Box
            sx={{
              display: "grid",
              gap: 2,
              // At most PER_ROW cards a row; narrower screens fit fewer.
              gridTemplateColumns: `repeat(auto-fill, minmax(max(220px, calc((100% - ${
                PER_ROW - 1
              } * 16px) / ${PER_ROW})), 1fr))`,
            }}
          >
            {shown.map(({ profile, badges }) => (
              <DirectoryCard
                key={profile.id}
                profile={profile}
                onSelect={onSelect}
                accent={section.color}
                badges={badges}
              />
            ))}
          </Box>
          {hidden > 0 &&
            (open ? (
              <Button
                size="small"
                onClick={() => toggle(section.key)}
                aria-expanded
                endIcon={<ExpandLessIcon />}
                sx={{ mt: 1.5, color: section.color }}
              >
                {copy.showLess}
              </Button>
            ) : (
              <MoreBar
                color={section.color}
                hidden={section.members.slice(COLLAPSED_COUNT).map((m) => m.profile)}
                onOpen={() => toggle(section.key)}
              />
            ))}
        </Box>
        );
      })}
    </Stack>
  );
}

/**
 * The people a collapsed group is not showing, made hard to miss: a bar as
 * wide as the cards, in the group colour, with the hidden people's faces.
 */
function MoreBar({
  color,
  hidden,
  onOpen,
}: {
  color: string;
  hidden: Profile[];
  onOpen: () => void;
}) {
  const copy = portalCopy.volunteerDirectory;
  return (
    <ButtonBase
      onClick={onOpen}
      aria-expanded={false}
      sx={(theme) => {
        // Group colours are hex or a theme token; resolve tokens for alpha().
        const c = color.startsWith("#") ? color : theme.palette.secondary.main;
        return {
          mt: 2,
          width: "100%",
          justifyContent: "flex-start",
          gap: 1.5,
          px: 2,
          py: 1.5,
          borderRadius: 2,
          border: "2px dashed",
          borderColor: alpha(c, 0.55),
          bgcolor: alpha(c, 0.08),
          color: c,
          transition: "background-color .15s, border-color .15s",
          "&:hover, &:focus-visible": {
            bgcolor: alpha(c, 0.14),
            borderColor: c,
          },
          "& .more-pill": { bgcolor: c, color: theme.palette.getContrastText(c) },
        };
      }}
    >
      <AvatarGroup
        max={5}
        total={hidden.length}
        sx={{ "& .MuiAvatar-root": { width: 32, height: 32, fontSize: 13, borderColor: "background.paper" } }}
      >
        {hidden.slice(0, 5).map((p) => (
          <MemberAvatar key={p.id} src={p.avatar_url ?? undefined} alt={p.full_name ?? ""}>
            {(p.full_name ?? "·").slice(0, 1)}
          </MemberAvatar>
        ))}
      </AvatarGroup>
      <Typography fontWeight={700} sx={{ color: "text.primary" }}>
        {copy.hiddenCount(hidden.length)}
      </Typography>
      <Box sx={{ flexGrow: 1 }} />
      <Typography
        className="more-pill"
        variant="body2"
        fontWeight={700}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.25,
          pl: 1.5,
          pr: 1,
          py: 0.5,
          borderRadius: 999,
          whiteSpace: "nowrap",
        }}
      >
        {copy.showAll}
        <ExpandMoreIcon fontSize="small" />
      </Typography>
    </ButtonBase>
  );
}
