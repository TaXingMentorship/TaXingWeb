"use client";

import * as React from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import type { Profile } from "@/types/portal";
import {
  buildMentorsCsv,
  exportFileName,
  type MentorExportEntry,
} from "@/lib/portal/exportMentors";
import { downloadTextFile, localDateStamp } from "@/lib/portal/exportBrowser";
import { portalCopy } from "@/data/portalCopy";

/**
 * 「导出 CSV」 on the directory's mentor tab: a copy of the mentors shown, for
 * mentees who cannot reach the portal. Who sees this is decided by the page
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
  const [error, setError] = React.useState<string | null>(null);

  const exportCsv = () => {
    setError(null);
    try {
      const entries: MentorExportEntry[] = mentors.map((profile) => ({
        profile,
        groupName: groupNameOf(profile.id),
      }));
      downloadTextFile(
        exportFileName(season, localDateStamp()),
        buildMentorsCsv(entries, copy),
        "text/csv;charset=utf-8",
      );
    } catch {
      setError(copy.failed);
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
          disabled={mentors.length === 0}
          startIcon={<FileDownloadIcon fontSize="small" />}
          onClick={exportCsv}
        >
          {copy.button}
        </Button>
      </Stack>
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
    </Stack>
  );
}
