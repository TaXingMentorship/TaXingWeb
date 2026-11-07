"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import GroupsIcon from "@mui/icons-material/Groups";
import SchoolIcon from "@mui/icons-material/School";
import PsychologyIcon from "@mui/icons-material/Psychology";
import VolunteerActivismIcon from "@mui/icons-material/VolunteerActivism";
import EventIcon from "@mui/icons-material/Event";
import Diversity3Icon from "@mui/icons-material/Diversity3";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import QuestionAnswerIcon from "@mui/icons-material/QuestionAnswer";
import UpdateIcon from "@mui/icons-material/Update";
import HourglassTopIcon from "@mui/icons-material/HourglassTop";
import HandshakeIcon from "@mui/icons-material/Handshake";
import ForumIcon from "@mui/icons-material/Forum";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import type { DashboardFunnel, DashboardStats } from "@/types/portal";
import { getDashboardStats, listRosterCohorts } from "@/lib/portal/store";
import { portalCopy } from "@/data/portalCopy";
import { QA_GROUP_SESSIONS_TOTAL } from "@/data/dashboardStatic";
import { usePortalSession } from "@/components/portal/PortalSessionProvider";
import {
  ACTIVITY_COLOR,
  CountTile,
  DashCard,
  Donut,
  type DonutSlice,
  FigureCell,
  LegendRow,
  MENTEE_COLOR,
  MENTOR_COLOR,
  StatTile,
  TOTAL_COLOR,
  VOLUNTEER_COLOR,
  volunteerRamp,
  VIZ,
  percent,
} from "@/components/portal/DashboardParts";

const EMPTY_FUNNEL: DashboardFunnel = { expected: 0, excluded: 0, activated: 0 };

const actual = (f: DashboardFunnel) => Math.max(0, f.expected - f.excluded);

export default function DashboardPage() {
  const copy = portalCopy.dashboard;
  const { currentUser } = usePortalSession();
  const allowed = Boolean(currentUser?.is_admin || currentUser?.is_volunteer);

  const { data: cohorts, isLoading: cohortsLoading, error: cohortsError } = useQuery({
    queryKey: ["portal", "rosterCohorts"],
    queryFn: listRosterCohorts,
    enabled: allowed,
  });
  const [cohortId, setCohortId] = React.useState("");
  React.useEffect(() => {
    if (!cohortId && cohorts?.length) setCohortId(cohorts[0].id);
  }, [cohorts, cohortId]);

  const { data: stats, isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: ["portal", "dashboardStats", cohortId],
    queryFn: () => getDashboardStats(cohortId),
    enabled: Boolean(cohortId),
    // Computed live on every load. No polling (keeps Supabase usage minimal);
    // a tab switched back to within 5 minutes reuses the cached numbers.
    staleTime: 5 * 60 * 1000,
  });

  if (!allowed) return <Alert severity="error">{copy.forbidden}</Alert>;

  return (
    <Stack spacing={1.5}>
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 2 }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h5" fontWeight={800}>
            {copy.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {copy.hint}
          </Typography>
          {stats ? (
            <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, mt: 0.75 }}>
              <Box
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.5,
                  px: 1.25,
                  py: 0.25,
                  borderRadius: 999,
                  bgcolor: "action.hover",
                }}
              >
                <UpdateIcon sx={{ fontSize: 16 }} color="action" />
                <Typography variant="body2" fontWeight={700}>
                  {copy.updatedAt(
                    new Date(dataUpdatedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
                  )}
                </Typography>
              </Box>
              <Typography variant="body2" fontWeight={700}>
                {copy.attention.title}：
              </Typography>
              <AttentionChips stats={stats} />
            </Box>
          ) : null}
          {stats ? (
            <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1.5, mt: 0.75 }}>
              <Typography variant="caption" color="text.secondary">
                {copy.colorLegend.label}：
              </Typography>
              {[
                [copy.headline.mentors, MENTOR_COLOR],
                [copy.headline.mentees, MENTEE_COLOR],
                [copy.headline.volunteers, VOLUNTEER_COLOR],
                [copy.colorLegend.activity, ACTIVITY_COLOR],
                [copy.colorLegend.total, TOTAL_COLOR],
              ].map(([label, color]) => (
                <Box key={label} sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: color }} />
                  <Typography variant="caption" color="text.secondary">
                    {label}
                  </Typography>
                </Box>
              ))}
            </Box>
          ) : null}
        </Box>
        {cohorts && cohorts.length > 0 ? (
          <TextField
            select
            size="small"
            label={copy.cohortLabel}
            value={cohortId}
            onChange={(e) => setCohortId(e.target.value)}
            sx={{ minWidth: 180 }}
          >
            {cohorts.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}
          </TextField>
        ) : null}
      </Box>

      {cohortsError || error ? (
        <Alert severity="error">{((cohortsError ?? error) as Error).message}</Alert>
      ) : null}
      {cohortsLoading || isLoading ? <LinearProgress aria-label={copy.loading} /> : null}
      {cohorts && cohorts.length === 0 ? <Alert severity="info">{copy.noCohorts}</Alert> : null}
      {stats ? <DashboardBody stats={stats} /> : null}
    </Stack>
  );
}

/** Invited-but-not-activated people. Before 0047 is re-run `pending` is absent; fall back to the funnel (no volunteers). */
function pendingOf(stats: DashboardStats) {
  const mentor = stats.funnel.mentor ?? EMPTY_FUNNEL;
  const mentee = stats.funnel.mentee ?? EMPTY_FUNNEL;
  return (
    stats.pending ?? {
      mentor: Math.max(0, actual(mentor) - mentor.activated),
      mentee: Math.max(0, actual(mentee) - mentee.activated),
      volunteer: 0,
    }
  );
}

type Attention = { key: string; level: "warning" | "info"; text: string; dot?: string };

/** What needs a human, as chips next to the update time at the top of the page. */
function AttentionChips({ stats }: { stats: DashboardStats }) {
  const copy = portalCopy.dashboard;
  const p = pendingOf(stats);
  const pendingTotal = p.mentor + p.mentee + p.volunteer;
  const unpaired = Math.max(0, (stats.accounts.mentee ?? 0) - stats.mentoring.paired_mentees);
  const mentorIdle = Math.max(0, (stats.accounts.mentor ?? 0) - stats.mentoring.mentors_with_mentee);

  const attention: Attention[] = [];
  if (pendingTotal > 0)
    attention.push({ key: "pending", level: "warning", text: copy.attention.pending(pendingTotal) });
  if (unpaired > 0)
    attention.push({ key: "unpaired", level: "info", text: copy.attention.unpaired(unpaired), dot: MENTEE_COLOR });
  if (mentorIdle > 0)
    attention.push({ key: "idle", level: "info", text: copy.attention.mentorIdle(mentorIdle), dot: MENTOR_COLOR });

  if (attention.length === 0)
    return (
      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color: "success.main" }}>
        <CheckCircleOutlineIcon fontSize="small" />
        <Typography variant="body2">{copy.attention.allGood}</Typography>
      </Box>
    );
  return (
    <>
      {attention.map((x) => (
        <Box
          key={x.key}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.75,
            px: 1.25,
            py: 0.25,
            borderRadius: 999,
            bgcolor: x.level === "warning" ? "warning.light" : "action.hover",
            color: x.level === "warning" ? "warning.contrastText" : "text.primary",
          }}
        >
          {x.level === "warning" ? (
            <WarningAmberIcon fontSize="small" />
          ) : (
            <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: x.dot, flexShrink: 0 }} />
          )}
          <Typography variant="body2" fontWeight={600}>
            {x.text}
          </Typography>
        </Box>
      ))}
    </>
  );
}

function DashboardBody({ stats }: { stats: DashboardStats }) {
  const copy = portalCopy.dashboard;
  const mentor = stats.funnel.mentor ?? EMPTY_FUNNEL;
  const mentee = stats.funnel.mentee ?? EMPTY_FUNNEL;
  const actualMentors = actual(mentor);
  const actualMentees = actual(mentee);
  const actualTotal = actualMentors + actualMentees;
  const activatedTotal = mentor.activated + mentee.activated;
  const m = stats.mentoring;
  const a = stats.activities;
  const menteeAccounts = stats.accounts.mentee ?? 0;
  const mentorAccounts = stats.accounts.mentor ?? 0;
  const unpaired = Math.max(0, menteeAccounts - m.paired_mentees);
  const mentorIdle = Math.max(0, mentorAccounts - m.mentors_with_mentee);

  const pending = pendingOf(stats);
  const pendingTotal = pending.mentor + pending.mentee + pending.volunteer;
  const pendingSlices: DonutSlice[] = [
    { label: copy.pendingBreakdown.mentee, value: pending.mentee, color: MENTEE_COLOR },
    { label: copy.pendingBreakdown.mentor, value: pending.mentor, color: MENTOR_COLOR },
    { label: copy.pendingBreakdown.volunteer, value: pending.volunteer, color: VOLUNTEER_COLOR },
  ];

  const groups = stats.volunteers.groups.filter((g) => g.count > 0).sort((x, y) => y.count - x.count);
  const ramp = volunteerRamp(groups.length);
  const volSlices: DonutSlice[] = groups.map((g, i) => ({ label: g.name, value: g.count, color: ramp[i] }));
  if (stats.volunteers.no_group > 0)
    volSlices.push({ label: copy.volunteers.noGroup, value: stats.volunteers.no_group, color: VIZ.other });

  // One-sentence takeaways shown under each card title.
  const pairingInsight = unpaired > 0 ? copy.insight.paired(unpaired) : copy.insight.pairedDone;
  const sessionsTotal = a.roundtable_total + a.office_hour_total + QA_GROUP_SESSIONS_TOTAL;
  const grid = (cols: object) => ({ display: "grid", gap: 1.5, gridTemplateColumns: cols });

  return (
    <Stack spacing={1.5}>
      {/* 1. The answer first: how many activated, and who is still missing. */}
      <Paper
        variant="outlined"
        sx={{
          p: { xs: 1.5, sm: 2 },
          borderRadius: 4,
          background: "linear-gradient(135deg, #fff8ea 0%, #ffffff 65%)",
          ...grid({ xs: "1fr", md: "1fr 1fr" }),
          gap: 2,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Donut
            size={130}
            thickness={13}
            ariaLabel={`${copy.hero.title} ${percent(activatedTotal, actualTotal)}`}
            slices={[{ label: copy.funnel.activated, value: activatedTotal, color: TOTAL_COLOR }]}
          >
            <Typography sx={{ fontSize: 36, fontWeight: 800, lineHeight: 1 }}>
              {percent(activatedTotal, actualTotal)}
            </Typography>
          </Donut>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              {copy.hero.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {copy.hero.scope}
            </Typography>
            <Typography variant="h6" fontWeight={800}>
              {copy.hero.detail(activatedTotal, actualTotal)}
            </Typography>
          </Box>
        </Box>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2.5,
            borderLeft: { md: "1px solid" },
            borderColor: { md: "divider" },
            pl: { md: 2 },
          }}
        >
          <Donut
            size={130}
            thickness={13}
            ariaLabel={copy.pendingBreakdown.title}
            slices={pendingSlices}
            showValues
          >
            <HourglassTopIcon sx={{ color: "text.secondary", fontSize: 18 }} />
            <Typography sx={{ fontSize: 32, fontWeight: 800, lineHeight: 1 }}>{pendingTotal}</Typography>
            <Typography variant="caption" color="text.secondary">
              {copy.pendingBreakdown.unit}
            </Typography>
          </Donut>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="subtitle1" fontWeight={700}>
              {copy.pendingBreakdown.title}
            </Typography>
            {pendingTotal === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {copy.pendingBreakdown.none}
              </Typography>
            ) : (
              pendingSlices.map((sl) => (
                <LegendRow key={sl.label} color={sl.color} label={sl.label} value={`${sl.value} ${copy.people}`} />
              ))
            )}
          </Box>
        </Box>
      </Paper>

      {/* 2. Headline numbers. */}
      <Box sx={grid({ xs: "1fr 1fr", md: "repeat(4, 1fr)" })}>
        <StatTile
          label={copy.headline.total}
          value={actualTotal}
          note={copy.headline.totalNote}
          icon={<GroupsIcon />}
          color={TOTAL_COLOR}
        />
        <StatTile label={copy.headline.mentors} value={actualMentors} icon={<PsychologyIcon />} color={MENTOR_COLOR} />
        <StatTile label={copy.headline.mentees} value={actualMentees} icon={<SchoolIcon />} color={MENTEE_COLOR} />
        <StatTile
          label={copy.headline.volunteers}
          value={stats.volunteers.total}
          note={copy.headline.volunteersNote(stats.volunteers.leads)}
          icon={<VolunteerActivismIcon />}
          color={VOLUNTEER_COLOR}
        />
      </Box>

      <Box sx={grid({ xs: "1fr", md: "repeat(2, 1fr)" })}>
        {/* 4. Funnel: a ring and four clear figures per role. */}
        <DashCard
          title={copy.funnel.title}
          hint={copy.funnel.hint}
          icon={<GroupsIcon color="action" />}
          sx={{ gridColumn: { md: "1 / -1" } }}
        >
          {mentor.expected + mentee.expected === 0 ? (
            <Typography color="text.secondary">{copy.funnel.noData}</Typography>
          ) : (
            <Box sx={grid({ xs: "1fr", md: "1fr 1fr" })}>
              {(
                [
                  [copy.headline.mentors, mentor, MENTOR_COLOR],
                  [copy.headline.mentees, mentee, MENTEE_COLOR],
                ] as const
              ).map(([label, f, color]) => (
                <Box
                  key={label}
                  sx={{ display: "flex", alignItems: "center", gap: 2.5, flexWrap: "wrap" }}
                >
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
                    <Donut
                      size={104}
                      thickness={12}
                      ariaLabel={`${label} ${copy.funnel.activated} ${percent(f.activated, actual(f))}`}
                      slices={[{ label: `${label} ${copy.funnel.activated}`, value: f.activated, color }]}
                    >
                      <Typography sx={{ fontSize: 24, fontWeight: 800, lineHeight: 1 }}>
                        {percent(f.activated, actual(f))}
                      </Typography>
                    </Donut>
                    <Typography variant="subtitle1" fontWeight={800}>
                      {label}
                    </Typography>
                  </Box>
                  <Box sx={{ ...grid({ xs: "1fr 1fr" }), gap: 1, flexGrow: 1, minWidth: 220 }}>
                    <FigureCell label={copy.funnel.expected} value={f.expected} />
                    <FigureCell label={copy.funnel.excluded} value={f.excluded} />
                    <FigureCell label={copy.funnel.actual} value={actual(f)} />
                    <FigureCell label={copy.funnel.activated} value={f.activated} accent={color} />
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </DashCard>

        {/* 5. Volunteers by group: the count sits on its own arc and in the legend. */}
        <DashCard title={copy.volunteers.title} icon={<VolunteerActivismIcon color="action" />}>
          {stats.volunteers.total === 0 ? (
            <Typography color="text.secondary">{copy.volunteers.empty}</Typography>
          ) : (
            <Box sx={{ display: "flex", alignItems: "center", gap: 2.5, flexWrap: "wrap" }}>
              <Donut size={150} thickness={26} slices={volSlices} showValues ariaLabel={copy.volunteers.title}>
                <Typography sx={{ fontSize: 30, fontWeight: 800, lineHeight: 1 }}>
                  {stats.volunteers.total}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {copy.volunteers.total}
                </Typography>
              </Donut>
              <Box>
                {volSlices.map((sl) => (
                  <LegendRow key={sl.label} color={sl.color} label={sl.label} value={`${sl.value} ${copy.people}`} />
                ))}
              </Box>
            </Box>
          )}
        </DashCard>

        {/* 6. Pairing. */}
        <DashCard title={copy.mentoring.title} insight={pairingInsight} icon={<HandshakeIcon color="action" />}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2.5, flexWrap: "wrap" }}>
            <Donut
              size={104}
              thickness={12}
              ariaLabel={copy.mentoring.paired}
              slices={[{ label: copy.mentoring.paired, value: m.paired_mentees, color: MENTEE_COLOR }]}
            >
              <Typography sx={{ fontSize: 24, fontWeight: 800, lineHeight: 1 }}>
                {percent(m.paired_mentees, menteeAccounts)}
              </Typography>
            </Donut>
            <Box sx={{ flexGrow: 1, minWidth: 160 }}>
              <Typography variant="body2" color="text.secondary">
                {copy.mentoring.paired}
              </Typography>
              <Typography sx={{ fontSize: 28, fontWeight: 800, lineHeight: 1.2 }}>
                {m.paired_mentees} / {menteeAccounts}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {copy.mentoring.pairedHint(m.mentors_with_mentee)}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ ...grid({ xs: "1fr 1fr" }), gap: 1, mt: 2 }}>
            <FigureCell label={copy.mentoring.unpaired} value={unpaired} />
            <FigureCell label={copy.mentoring.mentorIdle} value={mentorIdle} />
          </Box>
        </DashCard>

        {/* 7. Session totals only — no progress, these are end-of-season tallies. */}
        <DashCard
          title={copy.activities.title}
          hint={copy.activities.sessionsTotal(sessionsTotal)}
          icon={<EventIcon color="action" />}
          sx={{ gridColumn: { md: "1 / -1" } }}
        >
          <Box sx={grid({ xs: "1fr 1fr", md: "repeat(4, 1fr)" })}>
            <CountTile
              label={copy.activities.roundtable}
              value={a.roundtable_total}
              unit={copy.sessionsUnit}
              icon={<Diversity3Icon />}
              color={ACTIVITY_COLOR}
            />
            <CountTile
              label={copy.activities.officeHour}
              value={a.office_hour_total}
              unit={copy.sessionsUnit}
              icon={<SupportAgentIcon />}
              color={ACTIVITY_COLOR}
            />
            <CountTile
              label={copy.activities.qaGroup}
              value={QA_GROUP_SESSIONS_TOTAL}
              unit={copy.sessionsUnit}
              icon={<QuestionAnswerIcon />}
              color={ACTIVITY_COLOR}
              note={copy.activities.qaGroupNote}
            />
            <CountTile
              label={copy.board.title}
              value={stats.board.posts}
              unit={copy.board.unit}
              icon={<ForumIcon />}
              color={ACTIVITY_COLOR}
              note={copy.board.comments(stats.board.comments)}
            />
          </Box>
        </DashCard>
      </Box>

    </Stack>
  );
}
