"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
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
import type { ParticipantRole, Profile } from "@/types/portal";
import {
  listCohorts,
  listProfiles,
  listVolunteerGroups,
  listVolunteers,
} from "@/lib/portal/store";
import { usePortalSession } from "@/components/portal/PortalSessionProvider";
import ProfileDialog from "@/components/portal/ProfileDialog";
import DirectoryCard from "@/components/portal/DirectoryCard";
import VolunteerDirectory from "@/components/portal/VolunteerDirectory";

export default function DirectoryPage() {
  const { currentUser } = usePortalSession();
  const [tab, setTab] = React.useState<ParticipantRole | "volunteer">("mentor");
  const [cohortId, setCohortId] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [interests, setInterests] = React.useState<string[]>([]);
  const [selected, setSelected] = React.useState<Profile | null>(null);

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["portal", "profiles"],
    queryFn: () => listProfiles(),
  });
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

  /**
   * Profile ids that have a volunteer record behind them.
   *
   * This tab used to filter on `p.is_admin || p.is_volunteer`, which listed
   * every admin as a volunteer — with `is_volunteer` unset on every profile,
   * the tab showed the admin team and no volunteers at all. Being an admin is
   * not being a volunteer; the volunteer roster is.
   */
  const volunteerProfileIds = React.useMemo(
    () =>
      new Set(
        (volunteers ?? [])
          .map((volunteer) => volunteer.profile_id)
          .filter((id): id is string => Boolean(id)),
      ),
    [volunteers],
  );
  const isVolunteer = React.useCallback(
    (profile: Profile) =>
      profile.is_volunteer || volunteerProfileIds.has(profile.id),
    [volunteerProfileIds],
  );

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

  const visible = React.useMemo(() => {
    if (!profiles || !currentUser) return [];
    if (currentUser.is_admin) {
      return cohortId
        ? profiles.filter((profile) => profile.cohort_ids.includes(cohortId))
        : [];
    }
    return profiles.filter(
      (p) =>
        p.visible &&
        p.cohort_ids.some((c) => currentUser.cohort_ids.includes(c)),
    );
  }, [profiles, currentUser, cohortId]);

  const allInterests = React.useMemo(
    () => Array.from(new Set(visible.flatMap((p) => p.interests))).sort(),
    [visible],
  );

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return visible
      .filter((p) =>
        tab === "volunteer" ? isVolunteer(p) : p.participant_role === tab,
      )
      .filter((p) =>
        q
          ? [p.full_name, p.bio, p.background, ...p.interests]
              .filter(Boolean)
              .some((f) => f!.toLowerCase().includes(q))
          : true,
      )
      .filter((p) =>
        interests.length
          ? interests.every((i) => p.interests.includes(i))
          : true,
      );
  }, [visible, tab, search, interests, isVolunteer]);

  return (
    <Box>
      <Typography variant="h4" fontWeight={800} gutterBottom>
        成员目录
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        浏览导师、学员、负责人与志愿者，按姓名、简介或兴趣筛选。
      </Typography>

      {currentUser?.is_admin && (
        <TextField
         select
         size="small"
         label="选择项目"
         value={cohortId}
         onChange={(event) => setCohortId(event.target.value)}
         sx={{ minWidth: 240, mb: 2 }}
        >
         {(cohorts ?? []).map((cohort) => (
           <MenuItem key={cohort.id} value={cohort.id}>
             {cohort.name}
           </MenuItem>
         ))}
        </TextField>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="mentor" label={`导师（${visible.filter((p) => p.participant_role === "mentor").length}）`} />
        <Tab value="mentee" label={`学员（${visible.filter((p) => p.participant_role === "mentee").length}）`} />
        <Tab value="volunteer" label={`志愿者（${visible.filter(isVolunteer).length}）`} />
      </Tabs>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="搜索姓名、简介或兴趣"
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
        <Autocomplete
          multiple
          options={allInterests}
          value={interests}
          onChange={(_, v) => setInterests(v)}
          sx={{ minWidth: { sm: 280 }, width: "100%" }}
          renderInput={(params) => (
            <TextField {...params} size="small" placeholder="按兴趣筛选" />
          )}
        />
      </Stack>

      {isLoading ? (
        <Typography color="text.secondary">加载中…</Typography>
      ) : filtered.length === 0 ? (
        <Alert severity="info">没有符合条件的成员。</Alert>
      ) : (
        tab === "volunteer" ? (
          <VolunteerDirectory
            profiles={filtered}
            volunteers={volunteers ?? []}
            groups={groups ?? []}
            cohortId={volunteerCohortId}
            onSelect={setSelected}
          />
        ) : (
          <Grid container spacing={2}>
            {filtered.map((p) => (
              <Grid key={p.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <DirectoryCard profile={p} onSelect={setSelected} />
              </Grid>
            ))}
          </Grid>
        )
      )}

      <ProfileDialog profile={selected} onClose={() => setSelected(null)} />
    </Box>
  );
}
