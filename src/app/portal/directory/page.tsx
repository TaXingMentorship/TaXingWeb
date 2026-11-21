"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import InputAdornment from "@mui/material/InputAdornment";
import Autocomplete from "@mui/material/Autocomplete";
import Stack from "@mui/material/Stack";
import SearchIcon from "@mui/icons-material/Search";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import Pagination from "@mui/material/Pagination";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import type { ParticipantRole, Profile } from "@/types/portal";
import {
  listCohorts,
  listBlacklistedProfileIds,
  listMentorGroupMembers,
  listMentorGroups,
  listProfiles,
  listVolunteerGroups,
  listVolunteers,
} from "@/lib/portal/store";
import { canExportMentors } from "@/lib/portal/exportMentors";
import { usePortalSession } from "@/components/portal/PortalSessionProvider";
import ProfileDialog from "@/components/portal/ProfileDialog";
import DirectoryCard, { directoryGridSx } from "@/components/portal/DirectoryCard";
import { mentorGroupColors } from "@/data/mentorGroupColors";
import { matchesGroupFilter, matchesSearch, visibleToMember } from "@/lib/portal/directoryFilters";
import { portalCopy } from "@/data/portalCopy";
import ExportMentorsButton from "@/components/portal/ExportMentorsButton";
import VolunteerDirectory from "@/components/portal/VolunteerDirectory";
import { useFavorites } from "@/components/portal/useFavorites";
import MyMentorshipGroups from "@/components/portal/MyMentorshipGroups";

/** Four rows of the five-card grid; a page fits a laptop screen without long scrolling. */
const DIRECTORY_PAGE_SIZE = 20;

export default function DirectoryPage() {
  const { currentUser, realUser } = usePortalSession();
  const [tab, setTab] = React.useState<ParticipantRole | "volunteer">("mentor");
  const [cohortId, setCohortId] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [interests, setInterests] = React.useState<string[]>([]);
  const [selected, setSelected] = React.useState<Profile | null>(null);
  const [onlyFavorites, setOnlyFavorites] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const { ids: favoriteIds } = useFavorites();

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["portal", "profiles"],
    queryFn: () => listProfiles(),
  });
  const blacklistQuery = useQuery({
    queryKey: ["portal", "blacklist", realUser?.id],
    queryFn: listBlacklistedProfileIds,
    enabled: Boolean(realUser?.is_admin),
  });
  const blacklistIds = React.useMemo(
    () => new Set(blacklistQuery.data ?? []),
    [blacklistQuery.data],
  );
  const { data: cohorts } = useQuery({
    queryKey: ["portal", "cohorts"],
    queryFn: listCohorts,
  });
  const { data: volunteers } = useQuery({
    queryKey: ["portal", "volunteers"],
    queryFn: listVolunteers,
  });
  const { data: groups } = useQuery({
    queryKey: ["portal", "volunteer-groups"],
    queryFn: listVolunteerGroups,
  });

  React.useEffect(() => {
    if (!currentUser?.is_admin || cohortId || !cohorts?.length) return;
    setCohortId(cohorts[0].id);
  }, [cohortId, cohorts, currentUser?.is_admin]);

  /**
   * Group and lead are per season, so the volunteer tab needs one. Admins have
   * the picker; everyone else sees their newest season (`cohorts` is newest
   * first).
   */
  const volunteerCohortId = React.useMemo(() => {
    if (currentUser?.is_admin) return cohortId;
    return (
      cohorts?.find((c) => currentUser?.cohort_ids.includes(c.id))?.id ?? ""
    );
  }, [cohortId, cohorts, currentUser]);

  /**
   * Who counts as a volunteer *in the season shown* (`volunteerCohortId`): a
   * profile whose volunteer roster record has a `volunteer_seasons` row for it.
   *
   * This tab used to filter on `p.is_admin || p.is_volunteer`, which listed
   * every admin as a volunteer. It then took `is_volunteer` or a roster record
   * of *any* season, so a past volunteer who is a mentor or mentee this season
   * showed up here under 「未分组」. `profiles.is_volunteer` is one flag with no
   * season, so it does not decide this tab at all — the roster does.
   */
  const seasonVolunteerIds = React.useMemo(
    () =>
      new Set(
        (volunteers ?? [])
          .filter(
            (volunteer) =>
              volunteer.profile_id &&
              volunteer.seasons.some((s) => s.cohort_id === volunteerCohortId),
          )
          .map((volunteer) => volunteer.profile_id!),
      ),
    [volunteers, volunteerCohortId],
  );
  const isVolunteer = React.useCallback(
    (profile: Profile) => seasonVolunteerIds.has(profile.id),
    [seasonVolunteerIds],
  );

  /**
   * 「导出」 is for admins and the volunteers of the season shown. The user's own
   * id is looked up directly: their profile need not be among `visible`.
   */
  const canExport =
    // The persona being previewed must itself be an admin or a volunteer: the id
    // survives the lens, so without this a volunteer previewing 导师 or 学员
    // would still see the button.
    Boolean(currentUser?.is_admin || currentUser?.is_volunteer) &&
    canExportMentors({
      isAdmin: Boolean(currentUser?.is_admin),
      userId: currentUser?.id,
      seasonVolunteerIds,
    });

  // A mentor's answer group belongs to one season: the one the volunteer tab is
  // showing (an admin's picked project, otherwise the member's newest season).
  const { data: mentorGroups } = useQuery({
    queryKey: ["portal", "mentorGroups", volunteerCohortId],
    queryFn: () => listMentorGroups({ cohortId: volunteerCohortId }),
    enabled: Boolean(volunteerCohortId),
  });
  const { data: mentorGroupMembers } = useQuery({
    queryKey: ["portal", "mentorGroupMembers", volunteerCohortId],
    queryFn: () => listMentorGroupMembers({ cohortId: volunteerCohortId }),
    enabled: Boolean(volunteerCohortId),
  });
  const groupColors = React.useMemo(() => mentorGroupColors(mentorGroups ?? []), [mentorGroups]);
  const groupIdOf = React.useMemo(
    () => new Map((mentorGroupMembers ?? []).map((m) => [m.profile_id, m.group_id])),
    [mentorGroupMembers],
  );
  const groupOf = React.useCallback(
    (profile: Profile) => {
      const groupId = groupIdOf.get(profile.id);
      const group = mentorGroups?.find((g) => g.id === groupId);
      const color = groupId ? groupColors.get(groupId) : undefined;
      return group && color ? { name: group.name, color } : null;
    },
    [groupIdOf, mentorGroups, groupColors],
  );
  // The export names the group but does not need its colour.
  const groupNameOf = React.useCallback(
    (profileId: string) =>
      mentorGroups?.find((g) => g.id === groupIdOf.get(profileId))?.name ?? null,
    [groupIdOf, mentorGroups],
  );

  // The answer-group filter belongs to the season on screen, so a different
  // project brings a different set of groups and the old choice is dropped.
  const [groupFilter, setGroupFilter] = React.useState("all");
  React.useEffect(() => setGroupFilter("all"), [volunteerCohortId]);

  const visible = React.useMemo(() => {
    if (!profiles || !currentUser || (realUser?.is_admin && !blacklistQuery.data)) return [];
    if (currentUser.is_admin) {
      return cohortId
        ? profiles.filter((profile) => profile.cohort_ids.includes(cohortId) && !blacklistIds.has(profile.id))
        : [];
    }
    return profiles.filter((p) => !blacklistIds.has(p.id) && visibleToMember(p, currentUser.cohort_ids));
  }, [profiles, currentUser, cohortId, realUser?.is_admin, blacklistQuery.data, blacklistIds]);

  const allInterests = React.useMemo(
    () => Array.from(new Set(visible.flatMap((p) => p.interests))).sort(),
    [visible],
  );

  const favoriteSet = React.useMemo(() => new Set(favoriteIds), [favoriteIds]);
  // Bookmarks in the tab on screen, among the people the directory shows.
  const favoriteCount = visible.filter(
    (p) => p.participant_role === tab && favoriteSet.has(p.id),
  ).length;

  const filtered = React.useMemo(() => {
    return visible
      .filter((p) =>
        tab === "volunteer" ? isVolunteer(p) : p.participant_role === tab,
      )
      .filter((p) =>
        matchesSearch(search, p, tab === "mentor" ? groupOf(p)?.name : null),
      )
      .filter((p) =>
        tab === "mentor" ? matchesGroupFilter(groupFilter, groupIdOf.get(p.id)) : true,
      )
      .filter((p) => (onlyFavorites && tab !== "volunteer" ? favoriteSet.has(p.id) : true))
      .filter((p) =>
        interests.length
          ? interests.every((i) => p.interests.includes(i))
          : true,
      );
  }, [visible, tab, search, interests, isVolunteer, groupOf, groupIdOf, groupFilter, onlyFavorites, favoriteSet]);
  React.useEffect(() => {
    setPage(1);
  }, [tab, cohortId, search, interests, groupFilter, onlyFavorites]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / DIRECTORY_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const displayed = filtered.slice(
    (currentPage - 1) * DIRECTORY_PAGE_SIZE,
    currentPage * DIRECTORY_PAGE_SIZE,
  );

  // How many of the mentors on screen sit in each group, for the dropdown.
  const groupCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of visible) {
      if (p.participant_role !== "mentor") continue;
      const groupId = groupIdOf.get(p.id);
      if (groupId) counts.set(groupId, (counts.get(groupId) ?? 0) + 1);
    }
    return counts;
  }, [visible, groupIdOf]);
  const ungroupedCount = visible.filter(
    (p) => p.participant_role === "mentor" && !groupIdOf.has(p.id),
  ).length;
  const filterCopy = portalCopy.directoryFilters;

  // What gets exported: the mentors the filters show, within the one season the
  // export is for (an admin's picked project, a volunteer's own season).
  const exportable = React.useMemo(
    () =>
      tab === "mentor" && volunteerCohortId
        ? filtered.filter((p) => p.cohort_ids.includes(volunteerCohortId))
        : [],
    [tab, filtered, volunteerCohortId],
  );
  const seasonName = cohorts?.find((c) => c.id === volunteerCohortId)?.name ?? "";

  return (
    <Box>
      <Typography variant="h4" fontWeight={800} gutterBottom>
        成员目录
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        浏览导师、学员、负责人与志愿者，按姓名、简介或兴趣筛选。
      </Typography>

      {realUser?.is_admin && blacklistQuery.error ? (
        <Alert severity="error">{blacklistQuery.error.message}</Alert>
      ) : (!realUser?.is_admin || blacklistQuery.data) && (
        <MyMentorshipGroups excludedProfileIds={blacklistIds} />
      )}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }} alignItems={{ sm: "flex-start" }}>
        {currentUser?.is_admin && (
          <TextField
           select
           size="small"
           label="选择项目"
           value={cohortId}
           onChange={(event) => setCohortId(event.target.value)}
           sx={{ minWidth: { sm: 200 }, width: { xs: "100%", sm: "auto" }, flex: "none" }}
          >
           {(cohorts ?? []).map((cohort) => (
             <MenuItem key={cohort.id} value={cohort.id}>
               {cohort.name}
             </MenuItem>
           ))}
          </TextField>
        )}
        <TextField
          fullWidth
          size="small"
          placeholder={tab === "mentor" ? filterCopy.mentorSearchPlaceholder : filterCopy.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        {tab === "mentor" && (mentorGroups?.length ?? 0) > 0 && (
          <TextField
            select
            size="small"
            label={filterCopy.groupLabel}
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            sx={{ minWidth: { sm: 260 }, width: "100%" }}
          >
            <MenuItem value="all">{filterCopy.allGroups}</MenuItem>
            <MenuItem value="none">
              {filterCopy.groupOption(portalCopy.mentorGroups.unassigned, ungroupedCount)}
            </MenuItem>
            {(mentorGroups ?? []).map((group) => {
              const color = groupColors.get(group.id);
              return (
                <MenuItem key={group.id} value={group.id}>
                  <Box
                    component="span"
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      bgcolor: color?.dot,
                      mr: 1,
                      flex: "none",
                    }}
                  />
                  {filterCopy.groupOption(group.name, groupCounts.get(group.id) ?? 0)}
                </MenuItem>
              );
            })}
          </TextField>
        )}
        <Autocomplete
          multiple
          options={allInterests}
          value={interests}
          onChange={(_, v) => setInterests(v)}
          sx={{ minWidth: { sm: 280 }, width: "100%" }}
          renderInput={(params) => (
            <TextField {...params} size="small" placeholder={filterCopy.interestPlaceholder} />
          )}
        />
      </Stack>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="mentor" label={`导师（${visible.filter((p) => p.participant_role === "mentor").length}）`} />
        <Tab value="mentee" label={`学员（${visible.filter((p) => p.participant_role === "mentee").length}）`} />
        <Tab value="volunteer" label={`志愿者（${visible.filter(isVolunteer).length}）`} />
      </Tabs>

      {tab !== "volunteer" && (
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          flexWrap="wrap"
          useFlexGap
          spacing={1}
          sx={{ mb: 2 }}
        >
          <Chip
            clickable
            icon={onlyFavorites ? <FavoriteIcon /> : <FavoriteBorderIcon />}
            label={portalCopy.favorites.onlyFavorites(favoriteCount)}
            color={onlyFavorites ? "error" : "default"}
            variant={onlyFavorites ? "filled" : "outlined"}
            onClick={() => setOnlyFavorites((value) => !value)}
            aria-pressed={onlyFavorites}
          />
          {pageCount > 1 && (
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: "tabular-nums" }}>
                共 {filtered.length} 人
              </Typography>
              <Pagination
                size="small"
                shape="rounded"
                count={pageCount}
                page={currentPage}
                onChange={(_, value) => setPage(value)}
                siblingCount={0}
              />
            </Stack>
          )}
        </Stack>
      )}

      {tab === "mentor" && canExport && (
        <ExportMentorsButton
          mentors={exportable}
          groupNameOf={groupNameOf}
          season={seasonName}
        />
      )}

      {isLoading || (Boolean(realUser?.is_admin) && blacklistQuery.isLoading) ? (
        <Typography color="text.secondary">加载中…</Typography>
      ) : filtered.length === 0 ? (
        <Alert severity="info">
          {onlyFavorites && tab !== "volunteer" && favoriteCount === 0
            ? portalCopy.favorites.noneInTab
            : "没有符合条件的成员。"}
        </Alert>
      ) : (
        tab === "volunteer" ? (
          // Every volunteer, not one page of 12: the tab groups them, and a
          // page cut would shrink each group's count. Each group collapses to
          // two rows of five with its own 「+N」 instead (VolunteerDirectory).
          <VolunteerDirectory
            profiles={filtered}
            volunteers={volunteers ?? []}
            groups={groups ?? []}
            cohortId={volunteerCohortId}
            onSelect={setSelected}
          />
        ) : (
          <Box sx={directoryGridSx}>
            {displayed.map((p) => (
              <DirectoryCard
                key={p.id}
                profile={p}
                onSelect={setSelected}
                group={p.participant_role === "mentor" ? groupOf(p) : null}
              />
            ))}
          </Box>
        )
      )}

      <ProfileDialog
        profile={selected}
        onClose={() => setSelected(null)}
        groupName={selected?.participant_role === "mentor" ? groupOf(selected)?.name : null}
      />
    </Box>
  );
}
