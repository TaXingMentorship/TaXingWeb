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
  const { currentUser, loading: sessionLoading } = usePortalSession();
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

  if (sessionLoading) return <LinearProgress aria-label={copy.loading} />;
  if (!allowed) return <Alert severity="error">{copy.forbidden}</Alert>;

  return (
    // On desktop the page fills the viewport (top bar 64px + main padding 2×32px),
    // and DashboardBody grows its card rows to take the spare height.
    <Stack spacing={1.5} sx={{ minHeight: { md: "calc(100vh - 128px)" } }}>
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
      {stats ? <DashboardBody stats={stats} showQaGroup={cohortId === cohorts?.[0]?.id} /> : null}
    </Stack>
  );
}

/** Numbers shared by the attention chips and the body, computed once per stats object. */
function deriveCounts(stats: DashboardStats) {
  const mentor = stats.funnel.mentor ?? EMPTY_FUNNEL;
  const mentee = stats.funnel.mentee ?? EMPTY_FUNNEL;
  const menteeAccounts = stats.accounts.mentee ?? 0;
  const mentorAccounts = stats.accounts.mentor ?? 0;
  const pending = {
    mentor: Math.max(0, actual(mentor) - mentor.activated),
    mentee: Math.max(0, actual(mentee) - mentee.activated),
  };
  return {
    mentor,
    mentee,
    menteeAccounts,
    pending,
    pendingTotal: pending.mentor + pending.mentee,
    unpaired: Math.max(0, menteeAccounts - stats.mentoring.paired_mentees),
    mentorIdle: Math.max(0, mentorAccounts - stats.mentoring.mentors_with_mentee),
  };
}

type Attention = { key: string; level: "warning" | "info"; text: string; dot?: string };

/** What needs a human, as chips next to the update time at the top of the page. */
function AttentionChips({ stats }: { stats: DashboardStats }) {
  const copy = portalCopy.dashboard;
  const { pendingTotal, unpaired, mentorIdle } = deriveCounts(stats);

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

/**
 * A ring with its four figures: side by side on narrow screens, stacked (ring
 * on top) once four cards share a row.
 */
function DonutFigureCard({
  title,
  hint,
  icon,
  ariaLabel,
  max,
  slice,
  centre,
  children,
}: {
  title: string;
  hint?: string;
  icon: React.ReactNode;
  ariaLabel: string;
  max: number;
  slice: DonutSlice;
  centre: string;
  children: React.ReactNode;
}) {
  return (
    <DashCard title={title} hint={hint} icon={icon}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "136px minmax(0, 1fr)", lg: "minmax(0, 1fr)" },
          justifyItems: { lg: "center" },
          alignItems: "center",
          gap: 2,
          "& > :last-child": { width: "100%" },
        }}
      >
        <Donut size={136} thickness={14} ariaLabel={ariaLabel} max={max} slices={[slice]}>
          <Typography sx={{ fontSize: 30, fontWeight: 800, lineHeight: 1 }}>{centre}</Typography>
        </Donut>
        <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: "1fr 1fr" }}>{children}</Box>
      </Box>
    </DashCard>
  );
}

function DashboardBody({ stats, showQaGroup }: { stats: DashboardStats; showQaGroup: boolean }) {
  const copy = portalCopy.dashboard;
  const { mentor, mentee, menteeAccounts, pending, pendingTotal, unpaired, mentorIdle } = deriveCounts(stats);
  const actualMentors = actual(mentor);
  const actualMentees = actual(mentee);
  const actualTotal = actualMentors + actualMentees;
  const activatedTotal = mentor.activated + mentee.activated;
  const m = stats.mentoring;
  const a = stats.activities;

  const pendingSlices: DonutSlice[] = [
    { label: copy.pendingBreakdown.mentee, value: pending.mentee, color: MENTEE_COLOR },
    { label: copy.pendingBreakdown.mentor, value: pending.mentor, color: MENTOR_COLOR },
  ];

  const groups = stats.volunteers.groups.filter((g) => g.count > 0).sort((x, y) => y.count - x.count);
  const ramp = volunteerRamp(groups.length);
  // The ring is a partition, so the leadership group (战略组) shows only its
  // direct members there; the overlapping headcount gets its own line below.
  const leadership = stats.volunteers.leadership ?? null;
  const volSlices: DonutSlice[] = groups.map((g, i) => ({
    label: leadership && g.name === leadership.name ? `${g.name}${copy.volunteers.directSuffix}` : g.name,
    value: g.count,
    color: ramp[i],
  }));
  if (stats.volunteers.no_group > 0)
    volSlices.push({ label: copy.volunteers.noGroup, value: stats.volunteers.no_group, color: VIZ.other });

  // One-sentence takeaways shown under each card title.
  const pairingInsight = unpaired > 0 ? copy.insight.paired(unpaired) : copy.insight.pairedDone;
  const sessionsTotal = a.roundtable_total + a.office_hour_total + (showQaGroup ? QA_GROUP_SESSIONS_TOTAL : 0);
  const grid = (cols: object) => ({ display: "grid", gap: 1.5, gridTemplateColumns: cols });

  return (
    <Stack spacing={1.5} sx={{ flexGrow: 1 }}>
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
            max={actualTotal}
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

      {/* 3. Row one sits under the headline tiles: pairing under 实际参与, then Mentor, Mentee, volunteers. */}
      <Box
        sx={{
          ...grid({ xs: "1fr", md: "1fr 1fr", lg: "repeat(4, 1fr)" }),
          alignItems: "stretch",
          // Spare viewport height goes to the cards (3 : 1 with the row below).
          flex: { md: "3 1 auto" },
        }}
      >
        <DonutFigureCard
          title={copy.mentoring.title}
          hint={pairingInsight}
          icon={<HandshakeIcon color="action" />}
          ariaLabel={copy.mentoring.paired}
          max={menteeAccounts}
          slice={{ label: copy.mentoring.paired, value: Math.min(m.paired_mentees, menteeAccounts), color: MENTEE_COLOR }}
          centre={percent(m.paired_mentees, menteeAccounts)}
        >
          <FigureCell label={copy.mentoring.paired} value={`${m.paired_mentees}/${menteeAccounts}`} accent={MENTEE_COLOR} />
          <FigureCell label={copy.mentoring.mentorActive} value={m.mentors_with_mentee} />
          <FigureCell label={copy.mentoring.unpaired} value={unpaired} />
          <FigureCell label={copy.mentoring.mentorIdle} value={mentorIdle} />
        </DonutFigureCard>

        {mentor.expected + mentee.expected === 0 ? (
          <DashCard title={copy.funnel.title} icon={<GroupsIcon color="action" />}>
            <Typography color="text.secondary">{copy.funnel.noData}</Typography>
          </DashCard>
        ) : (
          (
            [
              [copy.headline.mentors, mentor, MENTOR_COLOR, <PsychologyIcon key="i" color="action" />],
              [copy.headline.mentees, mentee, MENTEE_COLOR, <SchoolIcon key="i" color="action" />],
            ] as const
          ).map(([label, f, color, icon]) => (
            <DonutFigureCard
              key={label}
              title={`${label} · ${copy.funnel.title}`}
              hint={copy.funnel.hint}
              icon={icon}
              ariaLabel={`${label} ${copy.funnel.activated} ${percent(f.activated, actual(f))}`}
              max={actual(f)}
              slice={{ label: `${label} ${copy.funnel.activated}`, value: f.activated, color }}
              centre={percent(f.activated, actual(f))}
            >
              <FigureCell label={copy.funnel.expected} value={f.expected} />
              <FigureCell label={copy.funnel.excluded} value={f.excluded} />
              <FigureCell label={copy.funnel.actual} value={actual(f)} />
              <FigureCell label={copy.funnel.activated} value={f.activated} accent={color} />
            </DonutFigureCard>
          ))
        )}

        <DashCard title={copy.volunteers.title} icon={<VolunteerActivismIcon color="action" />}>
          {stats.volunteers.total === 0 ? (
            <Typography color="text.secondary">{copy.volunteers.empty}</Typography>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
              <Donut size={150} thickness={26} slices={volSlices} showValues ariaLabel={copy.volunteers.title}>
                <Typography sx={{ fontSize: 30, fontWeight: 800, lineHeight: 1 }}>
                  {stats.volunteers.total}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {copy.volunteers.total}
                </Typography>
              </Donut>
              {/* The leadership line shares the legend's column, so its label
                  starts where the group labels above it start. */}
              <Box sx={{ maxWidth: "100%" }}>
                {volSlices.map((sl, i) => (
                  <LegendRow key={i} color={sl.color} label={sl.label} value={`${sl.value} ${copy.people}`} />
                ))}
                {leadership ? (
                  <Box sx={{ borderTop: "1px dashed", borderColor: "divider", mt: 1, pt: 1 }}>
                    <LegendRow
                      color="transparent"
                      label={copy.volunteers.leadershipLine(leadership.name)}
                      value={`${leadership.count} ${copy.people}`}
                    />
                    <Typography variant="caption" color="text.secondary" component="p" sx={{ pl: 2.25 }}>
                      {copy.volunteers.leadershipNote}
                    </Typography>
                  </Box>
                ) : null}
              </Box>
            </Box>
          )}
        </DashCard>
      </Box>

      {/* 4. Row two: activities & interaction, full width. */}
      <Box sx={{ display: "flex", flexDirection: "column", flex: { md: "1 1 auto" }, "& > *": { flexGrow: 1 } }}>
        {/* Session totals only — no progress, these are end-of-season tallies. */}
        <DashCard
          title={copy.activities.title}
          aside={copy.activities.sessionsTotal(sessionsTotal)}
          icon={<EventIcon color="action" />}
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
            {showQaGroup ? (
              <CountTile
                label={copy.activities.qaGroup}
                value={QA_GROUP_SESSIONS_TOTAL}
                unit={copy.sessionsUnit}
                icon={<QuestionAnswerIcon />}
                color={ACTIVITY_COLOR}
                note={copy.activities.qaGroupNote}
              />
            ) : null}
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
