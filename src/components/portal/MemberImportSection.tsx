"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DownloadIcon from "@mui/icons-material/Download";
import {
  importMembers,
  type MemberImportAction,
  type MemberImportResult,
  type MemberImportRow,
} from "@/lib/portal/store";
import {
  parseMemberFile,
  memberTemplateCsv,
  MemberParseError,
} from "@/lib/portal/memberImport";
import { portalCopy } from "@/data/portalCopy";

/** How each planned action reads, and how loudly. */
const ACTION_STYLE: Record<
  MemberImportAction,
  { label: string; color: "success" | "info" | "warning" | "default" }
> = {
  INVITE_ADDED: { label: "开通门户账号", color: "success" },
  INVITE_UPDATED: { label: "更新门户身份", color: "info" },
  INVITE_ALREADY_CLAIMED: { label: "已激活，身份请在成员名单改", color: "warning" },
  VOLUNTEER_ADDED: { label: "新增志愿者记录", color: "success" },
  VOLUNTEER_UPDATED: { label: "更新志愿者记录", color: "info" },
};

/**
 * The single member import: one spreadsheet, one row per person, and the 身份
 * column decides whether the row becomes a portal invitation, a volunteer
 * roster record, or both.
 *
 * The preview is not decoration. This form can hand out portal access, so the
 * admin sees per row exactly what will happen — and a count of how many
 * accounts are about to be opened — before anything is written.
 */
export default function MemberImportSection() {
  const copy = portalCopy.memberImport;
  const queryClient = useQueryClient();
  const fileRef = React.useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = React.useState("");
  const [rows, setRows] = React.useState<MemberImportRow[]>([]);
  const [parseError, setParseError] = React.useState("");
  const [parsing, setParsing] = React.useState(false);
  const [preview, setPreview] = React.useState<MemberImportResult | null>(null);
  const [result, setResult] = React.useState<MemberImportResult | null>(null);

  const reset = () => {
    setRows([]);
    setFileName("");
    setParseError("");
    setPreview(null);
    setResult(null);
  };

  const dryRun = useMutation({
    mutationFn: (parsed: MemberImportRow[]) => importMembers(parsed, { dryRun: true }),
    onSuccess: setPreview,
  });

  const commit = useMutation({
    mutationFn: () => importMembers(rows),
    onSuccess: (data) => {
      setResult(data);
      setPreview(null);
      for (const key of ["volunteers", "profiles", "rosterInvites", "cohorts"]) {
        queryClient.invalidateQueries({ queryKey: ["portal", key] });
      }
    },
  });

  const handleFile = async (file: File) => {
    reset();
    setFileName(file.name);
    setParsing(true);
    try {
      const parsed = await parseMemberFile(file);
      setRows(parsed);
      dryRun.mutate(parsed);
    } catch (error) {
      setRows([]);
      setParseError(
        error instanceof MemberParseError
          ? error.message
          : `解析失败：${(error as Error).message}`,
      );
    } finally {
      setParsing(false);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([memberTemplateCsv()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = copy.templateFileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const active = preview ?? result;
  const busy = parsing || dryRun.isPending || commit.isPending;

  return (
    <Box component="section">
      <Typography color="text.secondary" sx={{ mb: 1 }}>
        {copy.intro}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
        {copy.routingHint}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
        {copy.seasonHint}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {copy.dedupeHint}
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
            <Button variant="text" startIcon={<DownloadIcon />} onClick={downloadTemplate}>
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
            {parsing || dryRun.isPending ? (
              <Typography color="text.secondary">{copy.checking}</Typography>
            ) : null}
            {commit.isPending ? (
              <Typography color="text.secondary">{copy.importing}</Typography>
            ) : null}
          </Box>

          {preview?.ok ? (
            <>
              {preview.summary.invites_added > 0 ? (
                <Alert severity="warning">
                  {copy.accountWarning(preview.summary.invites_added)}
                </Alert>
              ) : null}
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
            </>
          ) : null}

          {result?.ok ? (
            <Alert severity="success" aria-live="polite">
              {copy.done(
                result.summary.invites_added,
                result.summary.volunteers_added,
                result.summary.volunteers_updated,
              )}
            </Alert>
          ) : null}
        </Stack>
      </Paper>

      {active ? (
        <Paper sx={{ p: 3, borderRadius: 3 }}>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            {preview ? copy.previewTitle : copy.resultTitle}
          </Typography>

          {active.ok ? (
            <Stack direction="row" spacing={1.5} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
              <Chip color="success" label={copy.countInvites(active.summary.invites_added)} />
              <Chip color="info" label={copy.countInviteUpdates(active.summary.invites_updated)} />
              <Chip color="success" label={copy.countVolunteers(active.summary.volunteers_added)} />
              <Chip color="info" label={copy.countVolunteerUpdates(active.summary.volunteers_updated)} />
            </Stack>
          ) : (
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
          )}

          {active.ok ? (
            <TableContainer sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>行</TableCell>
                    <TableCell>姓名</TableCell>
                    <TableCell>邮箱</TableCell>
                    <TableCell>季度</TableCell>
                    <TableCell>将执行</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {active.rows.map((entry) => (
                    <TableRow key={entry.row}>
                      <TableCell sx={{ fontVariantNumeric: "tabular-nums" }}>
                        {entry.row}
                      </TableCell>
                      <TableCell sx={{ wordBreak: "break-word" }}>{entry.full_name}</TableCell>
                      <TableCell sx={{ wordBreak: "break-all" }}>{entry.email ?? "—"}</TableCell>
                      <TableCell>{entry.seasons.join("、")}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                          {entry.actions.map((action) => (
                            <Chip
                              key={action}
                              size="small"
                              color={ACTION_STYLE[action]?.color ?? "default"}
                              label={ACTION_STYLE[action]?.label ?? action}
                            />
                          ))}
                        </Stack>
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
