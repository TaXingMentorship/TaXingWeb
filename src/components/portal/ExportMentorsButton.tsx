"use client";

import * as React from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import type { Profile } from "@/types/portal";
import {
  buildMentorsCsv,
  buildMentorsHtml,
  exportFileName,
  type MentorExportEntry,
} from "@/lib/portal/exportMentors";
import {
  downloadTextFile,
  loadAvatars,
  localDateStamp,
  printHtml,
} from "@/lib/portal/exportBrowser";
import { portalCopy } from "@/data/portalCopy";

/**
 * 「导出」 on the directory's mentor tab: an offline copy of the mentors shown,
 * for mentees who cannot reach the portal. Who sees this is decided by the page
 * (admins and the season's volunteers); it is a convenience, not a gate, since
 * everything exported is already visible in the directory.
 */
export default function ExportMentorsButton({
  mentors,
  groupNameOf,
  season,
}: {
  mentors: Profile[];
  groupNameOf: (profileId: string) => string | null;
  season: string;
}) {
  const copy = portalCopy.directoryExport;
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const run = async (kind: "pdf" | "csv") => {
    setAnchor(null);
    setError(null);
    setBusy(true);
    try {
      const exportedOn = localDateStamp();
      // The CSV has no pictures, so only the printable page fetches avatars.
      const avatars = kind === "pdf" ? await loadAvatars(mentors) : new Map<string, string | null>();
      const entries: MentorExportEntry[] = mentors.map((profile) => ({
        profile,
        groupName: groupNameOf(profile.id),
        avatar: avatars.get(profile.id) ?? null,
      }));
      if (kind === "csv") {
        downloadTextFile(
          exportFileName(season, exportedOn, "csv"),
          buildMentorsCsv(entries, copy),
          "text/csv;charset=utf-8",
        );
      } else {
        await printHtml(buildMentorsHtml(entries, { season, exportedOn, copy }));
      }
    } catch {
      setError(copy.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={1} alignItems={{ xs: "stretch", sm: "flex-end" }} sx={{ mb: 2 }}>
      <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="flex-end" flexWrap="wrap" useFlexGap>
        <Typography variant="body2" color="text.secondary">
          {copy.scopeHint(mentors.length, season)}
        </Typography>
        <Button
          variant="outlined"
          size="small"
          disabled={busy || mentors.length === 0}
          startIcon={busy ? <CircularProgress size={14} /> : <FileDownloadIcon fontSize="small" />}
          onClick={(event) => setAnchor(event.currentTarget)}
          aria-haspopup="menu"
        >
          {busy ? copy.preparing : copy.button}
        </Button>
        <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
          <MenuItem onClick={() => void run("pdf")}>{copy.menuPdf}</MenuItem>
          <MenuItem onClick={() => void run("csv")}>{copy.menuCsv}</MenuItem>
        </Menu>
      </Stack>
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
    </Stack>
  );
}
