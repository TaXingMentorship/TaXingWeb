"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import MemberAvatar from "@/components/portal/MemberAvatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ButtonBase from "@mui/material/ButtonBase";
import FavoriteIcon from "@mui/icons-material/Favorite";
import type { Profile } from "@/types/portal";
import { listCohorts, listMentorGroupMembers, listMentorGroups, listProfiles } from "@/lib/portal/store";
import { visibleToMember } from "@/lib/portal/directoryFilters";
import { portalCopy, profileLabels } from "@/data/portalCopy";
import { usePortalSession } from "@/components/portal/PortalSessionProvider";
import { useFavorites } from "@/components/portal/useFavorites";
import ProfileDialog from "@/components/portal/ProfileDialog";

/**
 * 我收藏的成员 on the portal home. Renders nothing without a bookmark, and a
 * bookmarked person the directory would not show this viewer is left out, so
 * the strip never lists someone the viewer cannot open.
 */
export default function FavoritesCard() {
  const { currentUser } = usePortalSession();
  const { ids } = useFavorites();
  const [selected, setSelected] = React.useState<Profile | null>(null);

  const { data: profiles } = useQuery({
    queryKey: ["portal", "favoriteProfiles", ids],
    queryFn: () => listProfiles({ ids }),
    enabled: ids.length > 0,
  });

  // Group names are per season; use the viewer's newest, like the directory.
  const { data: cohorts } = useQuery({
    queryKey: ["portal", "cohorts"],
    queryFn: listCohorts,
    enabled: ids.length > 0,
  });
  const cohortId = cohorts?.find((c) => currentUser?.cohort_ids.includes(c.id))?.id ?? "";
  const { data: groups } = useQuery({
    queryKey: ["portal", "mentorGroups", cohortId],
    queryFn: () => listMentorGroups({ cohortId }),
    enabled: Boolean(cohortId) && ids.length > 0,
  });
  const { data: members } = useQuery({
    queryKey: ["portal", "mentorGroupMembers", cohortId],
    queryFn: () => listMentorGroupMembers({ cohortId }),
    enabled: Boolean(cohortId) && ids.length > 0,
  });
  const groupName = (profileId: string) => {
    const groupId = members?.find((m) => m.profile_id === profileId)?.group_id;
    return groups?.find((g) => g.id === groupId)?.name ?? null;
  };

  const shown = React.useMemo(() => {
    if (!profiles || !currentUser) return [];
    const byId = new Map(profiles.map((p) => [p.id, p]));
    return ids
      .map((id) => byId.get(id))
      .filter((p): p is Profile => Boolean(p))
      .filter((p) => currentUser.is_admin || visibleToMember(p, currentUser.cohort_ids));
  }, [profiles, ids, currentUser]);

  if (shown.length === 0) return null;
  const copy = portalCopy.favorites;

  return (
    <Paper sx={{ p: 2.5, mb: 3, borderRadius: 3, borderLeft: 4, borderColor: "error.light" }}>
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <FavoriteIcon color="error" />
          <Typography variant="h6" fontWeight={700}>
            {copy.homeTitle(shown.length)}
          </Typography>
        </Stack>
        <Button component={Link} href="/portal/directory" size="small">
          {copy.homeAll}
        </Button>
      </Stack>
      <Grid container spacing={1.5}>
        {shown.map((p) => {
          const group = p.participant_role === "mentor" ? groupName(p.id) : null;
          return (
            <Grid key={p.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <ButtonBase
                onClick={() => setSelected(p)}
                sx={{
                  width: "100%",
                  justifyContent: "flex-start",
                  textAlign: "left",
                  gap: 1.5,
                  p: 1,
                  borderRadius: 2,
                  border: 1,
                  borderColor: "divider",
                }}
              >
                <MemberAvatar src={p.avatar_url ?? undefined} sx={{ width: 44, height: 44 }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography fontWeight={700} noWrap>
                    {p.full_name}
                  </Typography>
                  <Stack direction="row" spacing={0.5} sx={{ minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {profileLabels(p).join(" · ")}
                    </Typography>
                  </Stack>
                  {group && (
                    <Chip size="small" variant="outlined" label={portalCopy.board.groupChip(group)} sx={{ mt: 0.5, maxWidth: "100%" }} />
                  )}
                </Box>
              </ButtonBase>
            </Grid>
          );
        })}
      </Grid>
      <ProfileDialog
        profile={selected}
        onClose={() => setSelected(null)}
        groupName={selected?.participant_role === "mentor" ? groupName(selected.id) : null}
      />
    </Paper>
  );
}
