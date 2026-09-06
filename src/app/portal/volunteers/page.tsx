"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TablePagination from "@mui/material/TablePagination";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import InputAdornment from "@mui/material/InputAdornment";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import Link from "@mui/material/Link";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import SearchIcon from "@mui/icons-material/Search";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import Avatar from "@mui/material/Avatar";
import Tooltip from "@mui/material/Tooltip";
import LinkIcon from "@mui/icons-material/Link";
import StarFilledIcon from "@mui/icons-material/Star";
import type {
  Cohort,
  ResolvedVolunteerWithSeasons,
  VolunteerGroup,
  VolunteerSeason,
} from "@/types/portal";
import {
  deleteVolunteer,
  listCohorts,
  listVolunteerGroups,
  listVolunteers,
} from "@/lib/portal/store";
import { portalCopy } from "@/data/portalCopy";
import { usePortalSession } from "@/components/portal/PortalSessionProvider";
import VolunteerDialog from "@/components/portal/VolunteerDialog";

const ALL = "all";
const STORAGE_KEY = "taxing.portal.volunteers.group";
const ROWS_PER_PAGE = 25;
/** Season chips shown inline before folding into a "+N" that opens the history. */
const VISIBLE_CHIPS = 3;

/**
 * `useSearchParams` needs a Suspense boundary during prerender, so the page body
 * lives in a child component — same shape as /portal/board.
 */
export default function VolunteersPage() {
  return (
    <React.Suspense
      fallback={
        <Typography color="text.secondary">
          {portalCopy.volunteers.loading}
        </Typography>
      }
    >
      <VolunteersPageContent />
    </React.Suspense>
  );
}

function VolunteersPageContent() {
  const copy = portalCopy.volunteers;
  const { currentUser } = usePortalSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const isAdmin = currentUser?.is_admin ?? false;

  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [editing, setEditing] = React.useState<ResolvedVolunteerWithSeasons | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [pendingDelete, setPendingDelete] =
    React.useState<ResolvedVolunteerWithSeasons | null>(null);
  const [seasonHistory, setSeasonHistory] =
    React.useState<ResolvedVolunteerWithSeasons | null>(null);

  // Typing filters a table of a hundred-plus rows; deferring the value keeps
  // the input itself responsive while the list catches up.
  const deferredSearch = React.useDeferredValue(search);

  const { data: volunteers, isLoading } = useQuery({
    queryKey: ["portal", "volunteers"],
    queryFn: listVolunteers,
    enabled: Boolean(currentUser),
  });
  const { data: groups } = useQuery({
    queryKey: ["portal", "volunteerGroups"],
    queryFn: listVolunteerGroups,
    enabled: Boolean(currentUser),
  });
  const { data: cohorts } = useQuery({
    queryKey: ["portal", "cohorts"],
    queryFn: listCohorts,
    enabled: Boolean(currentUser),
  });

  const groupById = React.useMemo(
    () => new Map((groups ?? []).map((group) => [group.id, group])),
    [groups],
  );
  const cohortById = React.useMemo(
    () => new Map((cohorts ?? []).map((cohort) => [cohort.id, cohort])),
    [cohorts],
  );
  // Keyed off sort_order, not the filtered/reordered tab list, so a group's
  // colour does not shift when the tab order changes for a different viewer.
  const groupColor = React.useMemo(
    () =>
      new Map(
        (groups ?? []).map((group, index) => [
          group.id,
          GROUP_COLORS[index % GROUP_COLORS.length],
        ]),
      ),
    [groups],
  );

  /**
   * The groups this user belongs to, via their linked volunteer record. Someone
   * in several groups gets several — every one of them is marked in the tab row
   * and the first is where they land.
   */
  const myGroupIds = React.useMemo(() => {
    if (!currentUser || !volunteers) return new Set<string>();
    const mine = volunteers.find((v) => v.profile_id === currentUser.id);
    if (!mine) return new Set<string>();
    const ids = new Set(
      mine.seasons
        .map((season) => season.group_id)
        .filter((id): id is string => Boolean(id)),
    );
    // A lead belongs to the leadership group too, so it should be one of their
    // own tabs.
    if (mine.seasons.some((season) => season.is_lead)) {
      for (const group of groups ?? []) {
        if (group.includes_leads) ids.add(group.id);
      }
    }
    return ids;
  }, [currentUser, volunteers, groups]);

  /**
   * Tab order: 全部 first, then the user's own groups, then the rest. An admin
   * has no "own group" in this sense and sees the plain sort_order.
   */
  const orderedGroups = React.useMemo(() => {
    const all = groups ?? [];
    if (isAdmin || myGroupIds.size === 0) return all;
    const mine = all.filter((group) => myGroupIds.has(group.id));
    const others = all.filter((group) => !myGroupIds.has(group.id));
    return [...mine, ...others];
  }, [groups, isAdmin, myGroupIds]);

  /**
   * Which tab to land on when the URL does not say: an admin sees everyone, a
   * volunteer sees their own group, and the last choice is remembered in
   * between. Reading localStorage can throw in a private window, so it is
   * guarded and simply falls through to the role default.
   */
  const defaultGroup = React.useCallback((): string => {
    if (isAdmin) return ALL;
    try {
      const remembered = window.localStorage.getItem(STORAGE_KEY);
      if (remembered === ALL) return ALL;
      if (remembered && groupById.has(remembered)) return remembered;
    } catch {
      // Storage unavailable — fall through to the role default.
    }
    return orderedGroups.find((group) => myGroupIds.has(group.id))?.id ?? ALL;
  }, [isAdmin, groupById, orderedGroups, myGroupIds]);

  const requestedGroup = searchParams.get("group");
  const [fallbackGroup, setFallbackGroup] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (requestedGroup || !groups) return;
    setFallbackGroup(defaultGroup());
  }, [requestedGroup, groups, defaultGroup]);

  const groupId =
    requestedGroup && (requestedGroup === ALL || groupById.has(requestedGroup))
      ? requestedGroup
      : (fallbackGroup ?? ALL);

  const requestedCohort = searchParams.get("cohort");
  const cohortId =
    requestedCohort && cohortById.has(requestedCohort) ? requestedCohort : ALL;

  const setParams = React.useCallback(
    (next: { group?: string; cohort?: string }) => {
      const params = new URLSearchParams();
      params.set("group", next.group ?? groupId);
      params.set("cohort", next.cohort ?? cohortId);
      router.replace(`/portal/volunteers?${params.toString()}`, {
        scroll: false,
      });
      setPage(0);
    },
    [router, groupId, cohortId],
  );

  const selectGroup = (id: string) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Remembering the tab is a convenience; failing to is not an error.
    }
    setParams({ group: id });
  };

  /**
   * Whether a season counts towards a group. Direct membership, plus every lead
   * when the group carries `includes_leads` — that is how a lead of 运营组 also
   * shows up in 战略组 without a second row.
   */
  const inGroup = React.useCallback(
    (season: VolunteerSeason, target: string) => {
      if (season.group_id === target) return true;
      return Boolean(season.is_lead && groupById.get(target)?.includes_leads);
    },
    [groupById],
  );

  const filtered = React.useMemo(() => {
    if (!volunteers) return [];
    const query = deferredSearch.trim().toLowerCase();

    return volunteers.filter((volunteer) => {
      const seasons =
        cohortId === ALL
          ? volunteer.seasons
          : volunteer.seasons.filter((season) => season.cohort_id === cohortId);
      if (seasons.length === 0) return false;

      if (groupId !== ALL && !seasons.some((s) => inGroup(s, groupId))) {
        return false;
      }

      if (!query) return true;
      return [volunteer.full_name, volunteer.email, volunteer.wechat_number]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(query));
    });
  }, [volunteers, deferredSearch, cohortId, groupId, inGroup]);

  const visible = filtered.slice(
    page * ROWS_PER_PAGE,
    page * ROWS_PER_PAGE + ROWS_PER_PAGE,
  );

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVolunteer(id),
    onSuccess: () => {
      setPendingDelete(null);
      queryClient.invalidateQueries({ queryKey: ["portal", "volunteers"] });
    },
  });

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (volunteer: ResolvedVolunteerWithSeasons) => {
    setEditing(volunteer);
    setDialogOpen(true);
  };

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ sm: "flex-start" }}
        spacing={2}
        sx={{ mb: 1 }}
      >
        <Box>
          <Typography variant="h4" fontWeight={800} gutterBottom>
            {copy.title}
          </Typography>
          <Typography color="text.secondary">{copy.subtitle}</Typography>
        </Box>
        {isAdmin ? (
          <Button
            variant="contained"
            color="secondary"
            startIcon={<PersonAddAlt1Icon />}
            onClick={openCreate}
          >
            {copy.addButton}
          </Button>
        ) : null}
      </Stack>

      <Tabs
        value={groupId}
        onChange={(_, value: string) => selectGroup(value)}
        variant="scrollable"
        scrollButtons="auto"
        aria-label={copy.title}
        sx={{ mb: 2 }}
      >
        <Tab value={ALL} label={copy.allTab} />
        {orderedGroups.map((group) => (
          <Tab
            key={group.id}
            value={group.id}
            label={
              myGroupIds.has(group.id) ? (
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <Box
                    aria-hidden="true"
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      bgcolor: "secondary.main",
                    }}
                  />
                  <span>{group.name}</span>
                </Stack>
              ) : (
                group.name
              )
            }
            aria-label={
              myGroupIds.has(group.id)
                ? `${group.name}（${copy.myGroupHint}）`
                : group.name
            }
          />
        ))}
      </Tabs>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems={{ sm: "center" }}
        sx={{ mb: 2 }}
      >
        <TextField
          size="small"
          label={copy.searchLabel}
          placeholder={copy.searchPlaceholder}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(0);
          }}
          spellCheck={false}
          sx={{ flex: 1, minWidth: 0 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" aria-hidden="true" />
                </InputAdornment>
              ),
            },
          }}
        />
        <TextField
          select
          size="small"
          label={copy.seasonLabel}
          value={cohortId}
          onChange={(event) => setParams({ cohort: event.target.value })}
          sx={{ minWidth: { sm: 200 } }}
        >
          <MenuItem value={ALL}>{copy.allSeasons}</MenuItem>
          {(cohorts ?? []).map((cohort) => (
            <MenuItem key={cohort.id} value={cohort.id}>
              {cohort.name}
            </MenuItem>
          ))}
        </TextField>
        <Typography
          color="text.secondary"
          variant="body2"
          aria-live="polite"
          sx={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}
        >
          {copy.count(filtered.length)}
        </Typography>
      </Stack>

      {isLoading ? (
        <Typography color="text.secondary">{copy.loading}</Typography>
      ) : filtered.length === 0 ? (
        <Alert severity="info">
          {(volunteers?.length ?? 0) === 0 ? copy.emptyAll : copy.empty}
        </Alert>
      ) : (
        <Paper sx={{ borderRadius: 3, overflow: "hidden" }}>
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{copy.columns.name}</TableCell>
                  <TableCell>{copy.seasonGroupColumn}</TableCell>
                  <TableCell>{copy.columns.email}</TableCell>
                  <TableCell>{copy.columns.wechat}</TableCell>
                  {isAdmin ? (
                    <TableCell align="right">{copy.columns.actions}</TableCell>
                  ) : null}
                </TableRow>
              </TableHead>
              <TableBody>
                {visible.map((volunteer) => (
                  <VolunteerRow
                    key={volunteer.id}
                    volunteer={volunteer}
                    cohortId={cohortId}
                    groupById={groupById}
                    groupColor={groupColor}
                    cohortById={cohortById}
                    isAdmin={isAdmin}
                    onEdit={openEdit}
                    onDelete={setPendingDelete}
                    onShowSeasons={setSeasonHistory}
                  />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={filtered.length}
            page={page}
            onPageChange={(_, next) => setPage(next)}
            rowsPerPage={ROWS_PER_PAGE}
            rowsPerPageOptions={[ROWS_PER_PAGE]}
            labelDisplayedRows={({ from, to, count }) =>
              `${from}–${to} / ${count}`
            }
          />
        </Paper>
      )}

      <SeasonHistoryDialog
        volunteer={seasonHistory}
        groupById={groupById}
        cohortById={cohortById}
        onClose={() => setSeasonHistory(null)}
      />

      <VolunteerDialog
        open={dialogOpen}
        volunteer={editing}
        cohorts={cohorts ?? []}
        groups={groups ?? []}
        onClose={() => setDialogOpen(false)}
        onSaved={() => {
          setDialogOpen(false);
          queryClient.invalidateQueries({ queryKey: ["portal", "volunteers"] });
        }}
      />

      <Dialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{copy.deleteTitle}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {pendingDelete ? copy.deleteConfirm(pendingDelete.full_name) : ""}
          </DialogContentText>
          {deleteMutation.isError ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              {(deleteMutation.error as Error).message}
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDelete(null)}>{copy.cancel}</Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (pendingDelete) deleteMutation.mutate(pendingDelete.id);
            }}
          >
            {copy.deleteAction}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

/**
 * Colour per group, assigned by position so the same group keeps the same
 * colour down the whole column and a change of group is visible at a glance.
 */
const GROUP_COLORS = [
  "primary",
  "secondary",
  "success",
  "warning",
  "info",
  "error",
] as const;

/**
 * Extracted so a keystroke in the search box does not re-render every row's
 * chip list — and so the component is never redefined mid-render.
 */
function VolunteerRow({
  volunteer,
  cohortId,
  groupById,
  groupColor,
  cohortById,
  isAdmin,
  onEdit,
  onDelete,
  onShowSeasons,
}: {
  volunteer: ResolvedVolunteerWithSeasons;
  cohortId: string;
  groupById: Map<string, VolunteerGroup>;
  groupColor: Map<string, (typeof GROUP_COLORS)[number]>;
  cohortById: Map<string, Cohort>;
  isAdmin: boolean;
  onEdit: (volunteer: ResolvedVolunteerWithSeasons) => void;
  onDelete: (volunteer: ResolvedVolunteerWithSeasons) => void;
  onShowSeasons: (volunteer: ResolvedVolunteerWithSeasons) => void;
}) {
  const copy = portalCopy.volunteers;

  // One chip per season, newest first, each carrying that season's group. This
  // is the column that answers "was A in 项目组 in 2025春季 and 人事组 in
  // 2026秋季?" — a separate 组别 column could only ever show the union.
  const chips = React.useMemo(() => {
    const relevant =
      cohortId === ALL
        ? volunteer.seasons
        : volunteer.seasons.filter((season) => season.cohort_id === cohortId);

    return relevant
      .map((season) => ({
        cohort: cohortById.get(season.cohort_id),
        group: season.group_id ? groupById.get(season.group_id) : undefined,
        isLead: season.is_lead,
      }))
      .filter(
        (
          entry,
        ): entry is {
          cohort: Cohort;
          group: VolunteerGroup | undefined;
          isLead: boolean;
        } => Boolean(entry.cohort),
      )
      .sort((a, b) =>
        (b.cohort.starts_at ?? "").localeCompare(a.cohort.starts_at ?? ""),
      );
  }, [volunteer.seasons, cohortId, cohortById, groupById]);

  const shown = chips.slice(0, VISIBLE_CHIPS);
  const hidden = chips.length - shown.length;

  return (
    <TableRow hover>
      <TableCell sx={{ minWidth: 150 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Avatar
            src={volunteer.avatar_url ?? undefined}
            sx={{ width: 28, height: 28, fontSize: 13 }}
          >
            {volunteer.full_name.slice(0, 1)}
          </Avatar>
          <Typography
            variant="body2"
            fontWeight={600}
            sx={{ wordBreak: "break-word" }}
          >
            {volunteer.full_name}
          </Typography>
          {volunteer.profile_id ? (
            <Tooltip title={copy.linkedChip}>
              <LinkIcon fontSize="inherit" color="action" aria-label={copy.linkedChip} />
            </Tooltip>
          ) : null}
          {volunteer.is_public ? null : (
            <Tooltip title={copy.notPublicHint}>
              <VisibilityOffOutlinedIcon
                fontSize="inherit"
                color="disabled"
                aria-label={copy.notPublic}
              />
            </Tooltip>
          )}
        </Stack>
      </TableCell>

      <TableCell sx={{ minWidth: 220 }}>
        {chips.length === 0 ? (
          <Typography variant="body2" color="text.disabled">
            —
          </Typography>
        ) : (
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            {shown.map(({ cohort, group, isLead }) => (
              <Chip
                key={cohort.id}
                size="small"
                variant={group ? "filled" : "outlined"}
                color={group ? groupColor.get(group.id) ?? "default" : "default"}
                icon={isLead ? <StarFilledIcon fontSize="small" /> : undefined}
                label={
                  group
                    ? `${cohort.name} · ${group.name}${isLead ? ` ${copy.leadChip}` : ""}`
                    : cohort.name
                }
              />
            ))}
            {hidden > 0 ? (
              <Chip
                size="small"
                variant="outlined"
                label={copy.moreSeasons(hidden)}
                onClick={() => onShowSeasons(volunteer)}
                aria-label={`${copy.seasonDetailTitle}：${volunteer.full_name}`}
              />
            ) : null}
          </Stack>
        )}
      </TableCell>

      <TableCell sx={{ minWidth: 160 }}>
        {volunteer.email ? (
          <Link
            href={`mailto:${volunteer.email}`}
            variant="body2"
            sx={{ wordBreak: "break-all" }}
          >
            {volunteer.email}
          </Link>
        ) : (
          <Typography variant="body2" color="text.disabled">
            —
          </Typography>
        )}
      </TableCell>
      <TableCell sx={{ minWidth: 100 }}>
        <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
          {volunteer.wechat_number ?? "—"}
        </Typography>
      </TableCell>
      {isAdmin ? (
        <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
          <IconButton
            size="small"
            aria-label={`${copy.editTitle}：${volunteer.full_name}`}
            onClick={() => onEdit(volunteer)}
          >
            <EditOutlinedIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            color="error"
            aria-label={`${copy.deleteButton}：${volunteer.full_name}`}
            onClick={() => onDelete(volunteer)}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </TableCell>
      ) : null}
    </TableRow>
  );
}

/** The full participation history, for someone with more seasons than fit inline. */
function SeasonHistoryDialog({
  volunteer,
  groupById,
  cohortById,
  onClose,
}: {
  volunteer: ResolvedVolunteerWithSeasons | null;
  groupById: Map<string, VolunteerGroup>;
  cohortById: Map<string, Cohort>;
  onClose: () => void;
}) {
  const copy = portalCopy.volunteers;
  if (!volunteer) return null;

  const rows = volunteer.seasons
    .map((season) => ({
      cohort: cohortById.get(season.cohort_id),
      group: season.group_id ? groupById.get(season.group_id) : undefined,
      isLead: season.is_lead,
    }))
    .filter(
      (
        entry,
      ): entry is {
        cohort: Cohort;
        group: VolunteerGroup | undefined;
        isLead: boolean;
      } => Boolean(entry.cohort),
    )
    .sort((a, b) =>
      (b.cohort.starts_at ?? "").localeCompare(a.cohort.starts_at ?? ""),
    );

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        {copy.seasonDetailTitle} · {volunteer.full_name}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          {rows.map(({ cohort, group, isLead }) => (
            <Stack
              key={cohort.id}
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              spacing={2}
            >
              <Typography variant="body2" fontWeight={600}>
                {cohort.name}
              </Typography>
              <Typography
                variant="body2"
                color={group ? "text.primary" : "text.disabled"}
              >
                {group?.name ?? copy.noGroup}
                {isLead ? ` · ${copy.leadChip}` : ""}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{copy.cancel}</Button>
      </DialogActions>
    </Dialog>
  );
}
