"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import type {
  Profile,
  ResolvedVolunteerWithSeasons,
  VolunteerGroup,
} from "@/types/portal";
import DirectoryCard, { type DirectoryBadge } from "./DirectoryCard";

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

  return (
    <Stack spacing={4}>
      {sections.map((section) => (
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
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            }}
          >
            {section.members.map(({ profile, badges }) => (
              <DirectoryCard
                key={profile.id}
                profile={profile}
                onSelect={onSelect}
                accent={section.color}
                badges={badges}
              />
            ))}
          </Box>
        </Box>
      ))}
    </Stack>
  );
}
