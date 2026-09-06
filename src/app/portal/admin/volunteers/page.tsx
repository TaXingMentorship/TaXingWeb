"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DownloadIcon from "@mui/icons-material/Download";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import type { VolunteerGroup } from "@/types/portal";
import Avatar from "@mui/material/Avatar";
import LinkIcon from "@mui/icons-material/Link";
import {
  deleteVolunteerGroup,
  importVolunteers,
  linkVolunteerProfile,
  listLinkCandidates,
  listVolunteerGroups,
  listVolunteers,
  type VolunteerImportResult,
  type VolunteerImportRow,
} from "@/lib/portal/store";
import {
  parseVolunteerFile,
  volunteerTemplateCsv,
  VolunteerParseError,
} from "@/lib/portal/volunteerImport";
import { portalCopy } from "@/data/portalCopy";
import { usePortalSession } from "@/components/portal/PortalSessionProvider";
import VolunteerGroupDialog from "@/components/portal/VolunteerGroupDialog";

export default function AdminVolunteersPage() {
  const copy = portalCopy.adminVolunteers;
  const { currentUser } = usePortalSession();

  // The page also guards itself: nav filtering is presentation only, and RLS
  // plus requireApiRole are the real boundaries.
  if (!currentUser?.is_admin) {
    return <Alert severity="error">{copy.adminOnly}</Alert>;
  }

  return (
    <Box sx={{ maxWidth: 1000 }}>
      <Typography variant="h4" fontWeight={800} gutterBottom>
        {copy.title}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {copy.subtitle}
      </Typography>

      <ImportSection />
      <Divider sx={{ my: 5 }} />
      <LinkCandidatesSection />
      <Divider sx={{ my: 5 }} />
      <GroupsSection />
    </Box>
  );
}

function ImportSection() {
  const copy = portalCopy.adminVolunteers;
  const queryClient = useQueryClient();
  const fileRef = React.useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = React.useState("");
  const [rows, setRows] = React.useState<VolunteerImportRow[]>([]);
  const [parseError, setParseError] = React.useState("");
  const [parsing, setParsing] = React.useState(false);
  const [preview, setPreview] = React.useState<VolunteerImportResult | null>(null);
  const [result, setResult] = React.useState<VolunteerImportResult | null>(null);

  const reset = () => {
    setRows([]);
    setFileName("");
    setParseError("");
    setPreview(null);
    setResult(null);
  };

  const dryRun = useMutation({
    mutationFn: (parsed: VolunteerImportRow[]) =>
      importVolunteers(parsed, { dryRun: true }),
    onSuccess: setPreview,
  });

  const commit = useMutation({
    mutationFn: () => importVolunteers(rows),
    onSuccess: (data) => {
      setResult(data);
      setPreview(null);
      queryClient.invalidateQueries({ queryKey: ["portal", "volunteers"] });
      queryClient.invalidateQueries({ queryKey: ["portal", "cohorts"] });
    },
  });

  const handleFile = async (file: File) => {
    reset();
    setFileName(file.name);
    setParsing(true);
    try {
      const parsed = await parseVolunteerFile(file);
      setRows(parsed);
      dryRun.mutate(parsed);
    } catch (error) {
      setRows([]);
      setParseError(
        error instanceof VolunteerParseError
          ? error.message
          : `解析失败：${(error as Error).message}`,
      );
    } finally {
      setParsing(false);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([volunteerTemplateCsv()], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = copy.templateFileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const active = preview ?? result;
  const blocked = active !== null && !active.ok;
  const busy = parsing || dryRun.isPending || commit.isPending;

  return (
    <Box component="section">
      <Typography variant="h5" fontWeight={800} gutterBottom>
        {copy.importTitle}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 1 }}>
        {copy.importIntro}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
        {copy.importSeasonHint}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {copy.importDedupeHint}
      </Typography>

      <Paper sx={{ p: 3, borderRadius: 3, mb: 3 }}>
        <Stack spacing={2}>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
              event.target.value = "";
            }}
          />
          <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
            <Button
              variant="outlined"
              startIcon={<UploadFileIcon />}
              onClick={() => fileRef.current?.click()}
              disabled={busy}
            >
              {copy.chooseFile}
            </Button>
            <Button
              variant="text"
              startIcon={<DownloadIcon />}
              onClick={downloadTemplate}
            >
              {copy.downloadTemplate}
            </Button>
            {fileName ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ alignSelf: "center", fontVariantNumeric: "tabular-nums" }}
              >
                {copy.selected(fileName, rows.length)}
              </Typography>
            ) : null}
          </Stack>

          <Box aria-live="polite">
            {parseError ? <Alert severity="error">{parseError}</Alert> : null}
            {dryRun.isError ? (
              <Alert severity="error">{(dryRun.error as Error).message}</Alert>
            ) : null}
            {commit.isError ? (
              <Alert severity="error">{(commit.error as Error).message}</Alert>
            ) : null}
            {parsing ? (
              <Typography color="text.secondary">{copy.checking}</Typography>
            ) : null}
            {dryRun.isPending ? (
              <Typography color="text.secondary">{copy.checking}</Typography>
            ) : null}
            {commit.isPending ? (
              <Typography color="text.secondary">{copy.importing}</Typography>
            ) : null}
          </Box>

          {preview?.ok ? (
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              <Button
                variant="contained"
                color="secondary"
                disabled={busy}
                onClick={() => commit.mutate()}
              >
                {copy.confirmImport(rows.length)}
              </Button>
              <Button variant="text" onClick={() => fileRef.current?.click()}>
                {copy.recheck}
              </Button>
            </Stack>
          ) : null}

          {result?.ok ? (
            <Alert severity="success" aria-live="polite">
              {copy.done(result.added.length, result.updated.length)}
            </Alert>
          ) : null}
        </Stack>
      </Paper>

      {active ? (
        <Paper sx={{ p: 3, borderRadius: 3 }}>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            {preview ? copy.previewTitle : copy.resultTitle}
          </Typography>
          <Stack direction="row" spacing={1.5} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
            <Chip color="success" label={copy.willAdd(active.added.length)} />
            <Chip color="info" label={copy.willUpdate(active.updated.length)} />
            <Chip
              color={active.errors.length > 0 ? "error" : "default"}
              label={copy.errorCount(active.errors.length)}
            />
          </Stack>

          {blocked ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              <AlertTitle>{copy.blocked}</AlertTitle>
              <List dense disablePadding>
                {active.errors.map((issue, index) => (
                  <ListItem key={`${issue.row}-${issue.code}-${index}`} disableGutters>
                    <ListItemText primary={issue.message} />
                  </ListItem>
                ))}
              </List>
            </Alert>
          ) : null}

          {preview?.ok ? (
            <Alert severity="success" sx={{ mb: 2 }}>
              {copy.previewClean}
            </Alert>
          ) : null}

          {active.ok ? (
            <TableContainer sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>行</TableCell>
                    <TableCell>姓名</TableCell>
                    <TableCell>邮箱</TableCell>
                    <TableCell>季度</TableCell>
                    <TableCell>结果</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {active.added.map((entry) => (
                    <TableRow key={`add-${entry.row}`}>
                      <TableCell sx={{ fontVariantNumeric: "tabular-nums" }}>
                        {entry.row}
                      </TableCell>
                      <TableCell>{entry.full_name}</TableCell>
                      <TableCell sx={{ wordBreak: "break-all" }}>
                        {entry.email ?? "—"}
                      </TableCell>
                      <TableCell>{entry.seasons.join("、")}</TableCell>
                      <TableCell>
                        <Chip size="small" color="success" label={copy.added} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {active.updated.map((entry) => (
                    <TableRow key={`upd-${entry.row}`}>
                      <TableCell sx={{ fontVariantNumeric: "tabular-nums" }}>
                        {entry.row}
                      </TableCell>
                      <TableCell>{entry.full_name}</TableCell>
                      <TableCell sx={{ wordBreak: "break-all" }}>
                        {entry.email ?? "—"}
                      </TableCell>
                      <TableCell>{entry.seasons.join("、")}</TableCell>
                      <TableCell>
                        <Chip size="small" color="info" label={copy.updated} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : null}
        </Paper>
      ) : null}
    </Box>
  );
}

/**
 * Volunteers who share a name with a portal account but were not linked
 * automatically, because their emails differ or one side has none.
 *
 * The import refuses to merge two records on a name alone (NAME_MISMATCH), and
 * the linking triggers hold the same line. Same name is a lead, not proof — so
 * this list exists to put the judgement in front of a person.
 */
function LinkCandidatesSection() {
  const copy = portalCopy.adminVolunteers;
  const queryClient = useQueryClient();
  const [pending, setPending] = React.useState<{
    volunteerId: string;
    volunteerName: string;
    profileId: string;
    profileName: string;
  } | null>(null);

  const { data: candidates, isLoading } = useQuery({
    queryKey: ["portal", "volunteerLinkCandidates"],
    queryFn: listLinkCandidates,
  });

  const linkMutation = useMutation({
    mutationFn: ({ id, profileId }: { id: string; profileId: string }) =>
      linkVolunteerProfile(id, profileId),
    onSuccess: () => {
      setPending(null);
      queryClient.invalidateQueries({ queryKey: ["portal", "volunteers"] });
      queryClient.invalidateQueries({
        queryKey: ["portal", "volunteerLinkCandidates"],
      });
    },
  });

  return (
    <Box component="section">
      <Typography variant="h5" fontWeight={800} gutterBottom>
        {copy.matchesTitle}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {copy.matchesIntro}
      </Typography>

      {isLoading ? (
        <Typography color="text.secondary">{portalCopy.volunteers.loading}</Typography>
      ) : (candidates ?? []).length === 0 ? (
        <Alert severity="success">{copy.matchesEmpty}</Alert>
      ) : (
        <Paper sx={{ borderRadius: 3, overflow: "hidden" }}>
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{copy.matchVolunteer}</TableCell>
                  <TableCell>{copy.matchProfile}</TableCell>
                  <TableCell align="right">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(candidates ?? []).map(({ volunteer, profile }) => (
                  <TableRow key={volunteer.id} hover>
                    <TableCell sx={{ minWidth: 160 }}>
                      <Typography variant="body2" fontWeight={600}>
                        {volunteer.full_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {volunteer.email ?? "无邮箱"}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ minWidth: 200 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Avatar
                          src={profile.avatar_url ?? undefined}
                          sx={{ width: 28, height: 28, fontSize: 13 }}
                        />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600}>
                            {profile.full_name}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ wordBreak: "break-all" }}
                          >
                            {profile.email ?? "无邮箱"}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                      <Button
                        size="small"
                        startIcon={<LinkIcon />}
                        onClick={() =>
                          setPending({
                            volunteerId: volunteer.id,
                            volunteerName: volunteer.full_name,
                            profileId: profile.id,
                            profileName: profile.full_name ?? "",
                          })
                        }
                      >
                        {copy.matchConfirm}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      <Dialog
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{copy.matchConfirmTitle}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {pending
              ? copy.matchConfirmBody(pending.volunteerName, pending.profileName)
              : ""}
          </DialogContentText>
          {linkMutation.isError ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              {(linkMutation.error as Error).message}
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPending(null)}>
            {portalCopy.volunteers.cancel}
          </Button>
          <Button
            variant="contained"
            color="secondary"
            disabled={linkMutation.isPending}
            onClick={() => {
              if (pending) {
                linkMutation.mutate({
                  id: pending.volunteerId,
                  profileId: pending.profileId,
                });
              }
            }}
          >
            {copy.matchConfirm}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function GroupsSection() {
  const copy = portalCopy.adminVolunteers;
  const queryClient = useQueryClient();

  const [editing, setEditing] = React.useState<VolunteerGroup | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<VolunteerGroup | null>(
    null,
  );

  const { data: groups, isLoading } = useQuery({
    queryKey: ["portal", "volunteerGroups"],
    queryFn: listVolunteerGroups,
  });
  const { data: volunteers } = useQuery({
    queryKey: ["portal", "volunteers"],
    queryFn: listVolunteers,
  });

  // Season records per group — how much a rename or deletion touches.
  const membershipCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const volunteer of volunteers ?? []) {
      for (const season of volunteer.seasons) {
        if (!season.group_id) continue;
        counts.set(season.group_id, (counts.get(season.group_id) ?? 0) + 1);
      }
    }
    return counts;
  }, [volunteers]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVolunteerGroup(id),
    onSuccess: () => {
      setPendingDelete(null);
      queryClient.invalidateQueries({ queryKey: ["portal", "volunteerGroups"] });
      queryClient.invalidateQueries({ queryKey: ["portal", "volunteers"] });
    },
  });

  const nextSortOrder =
    (groups ?? []).reduce((max, group) => Math.max(max, group.sort_order), 0) + 10;

  return (
    <Box component="section">
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ sm: "center" }}
        spacing={2}
        sx={{ mb: 1 }}
      >
        <Typography variant="h5" fontWeight={800}>
          {copy.groupsTitle}
        </Typography>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          {copy.addGroup}
        </Button>
      </Stack>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {copy.groupsIntro}
      </Typography>

      {isLoading ? (
        <Typography color="text.secondary">{portalCopy.volunteers.loading}</Typography>
      ) : (groups ?? []).length === 0 ? (
        <Alert severity="info">{copy.groupsEmpty}</Alert>
      ) : (
        <Paper sx={{ borderRadius: 3, overflow: "hidden" }}>
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>组别</TableCell>
                  <TableCell>简介</TableCell>
                  <TableCell align="right">排序</TableCell>
                  <TableCell align="right">记录</TableCell>
                  <TableCell align="right">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(groups ?? []).map((group) => (
                  <TableRow key={group.id} hover>
                    <TableCell sx={{ fontWeight: 600, minWidth: 90 }}>
                      {group.name}
                    </TableCell>
                    <TableCell
                      sx={{
                        color: "text.secondary",
                        maxWidth: 380,
                        wordBreak: "break-word",
                      }}
                    >
                      {group.description ?? "—"}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>
                      {group.sort_order}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>
                      {copy.groupMembers(membershipCounts.get(group.id) ?? 0)}
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                      <IconButton
                        size="small"
                        aria-label={`${copy.editGroupTitle}：${group.name}`}
                        onClick={() => {
                          setEditing(group);
                          setDialogOpen(true);
                        }}
                      >
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        aria-label={`${copy.deleteGroupTitle}：${group.name}`}
                        onClick={() => setPendingDelete(group)}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      <VolunteerGroupDialog
        open={dialogOpen}
        group={editing}
        nextSortOrder={nextSortOrder}
        onClose={() => setDialogOpen(false)}
        onSaved={() => {
          setDialogOpen(false);
          queryClient.invalidateQueries({ queryKey: ["portal", "volunteerGroups"] });
        }}
      />

      <Dialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{copy.deleteGroupTitle}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {pendingDelete ? copy.deleteGroupConfirm(pendingDelete.name) : ""}
          </DialogContentText>
          {deleteMutation.isError ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              {(deleteMutation.error as Error).message}
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDelete(null)}>
            {portalCopy.volunteers.cancel}
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (pendingDelete) deleteMutation.mutate(pendingDelete.id);
            }}
          >
            {portalCopy.volunteers.deleteAction}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
