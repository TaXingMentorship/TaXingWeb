"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import InputAdornment from "@mui/material/InputAdornment";
import Autocomplete from "@mui/material/Autocomplete";
import Avatar from "@mui/material/Avatar";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import Alert from "@mui/material/Alert";
import type { ParticipantRole, Profile } from "@/types/portal";
import { listCohorts, listProfiles, listVolunteers } from "@/lib/portal/store";
import { profileLabels } from "@/data/portalCopy";
import { usePortalSession } from "@/components/portal/PortalSessionProvider";

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
        浏览导师、学员、管理员与志愿者，按姓名、简介或兴趣筛选。
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
        <Grid container spacing={2}>
          {filtered.map((p) => (
            <Grid key={p.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card sx={{ height: "100%", borderRadius: 3 }}>
                <CardActionArea onClick={() => setSelected(p)} sx={{ height: "100%" }}>
                  <CardContent>
                    <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
                      <Avatar src={p.avatar_url ?? undefined} sx={{ width: 52, height: 52 }} />
                      <Box>
                        <Typography variant="h6" fontWeight={700} lineHeight={1.2}>
                          {p.full_name}
                        </Typography>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                          {profileLabels(p).map((label) => (
                            <Chip key={label} size="small" label={label} color="secondary" variant="outlined" />
                          ))}
                        </Stack>
                      </Box>
                    </Stack>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        minHeight: 40,
                      }}
                    >
                      {p.bio ?? "暂无简介"}
                    </Typography>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
                      {p.interests.slice(0, 3).map((i) => (
                        <Chip key={i} size="small" label={i} />
                      ))}
                    </Stack>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <ProfileDialog profile={selected} onClose={() => setSelected(null)} />
    </Box>
  );
}

function ProfileDialog({
  profile,
  onClose,
}: {
  profile: Profile | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={Boolean(profile)} onClose={onClose} maxWidth="sm" fullWidth>
      {profile && (
        <>
          <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Avatar src={profile.avatar_url ?? undefined} sx={{ width: 56, height: 56 }} />
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h6" fontWeight={800}>
                {profile.full_name}
              </Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                {profileLabels(profile).map((label) => (
                  <Chip key={label} size="small" label={label} color="secondary" />
                ))}
              </Stack>
            </Box>
            <IconButton onClick={onClose} aria-label="关闭">
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers>
            <Field label="领域" value={profile.field} />
            <Field label="简介" value={profile.bio} />
            <Field label="学术经历 / 行业经历" value={profile.background} />
            {profile.participant_role === "mentor" && (
              <>
                <Field label="工作年限" value={profile.years_experience} />
                <Field label="可以帮助的 mentee 数量" value={profile.mentee_capacity} />
                <Field label="对 mentee 的期望" value={profile.mentee_expectations} />
                <Field label="擅长与不擅长的话题" value={profile.topics} />
              </>
            )}
            {profile.participant_role === "mentee" && (
              <Field label="问题 / 想获得的帮助" value={profile.help_needed} />
            )}
            {profile.interests.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  兴趣方向
                </Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {profile.interests.map((i) => (
                    <Chip key={i} label={i} size="small" />
                  ))}
                </Stack>
              </Box>
            )}
            {profile.linkedin && (
              <Link
                href={profile.linkedin}
                target="_blank"
                rel="noopener"
                sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
              >
                <LinkedInIcon fontSize="small" /> LinkedIn 主页
              </Link>
            )}
          </DialogContent>
        </>
      )}
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        {label}
      </Typography>
      <Typography variant="body1">{value}</Typography>
    </Box>
  );
}
