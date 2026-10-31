"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import AddIcon from "@mui/icons-material/Add";
import DescriptionIcon from "@mui/icons-material/Description";
import TimelineIcon from "@mui/icons-material/Timeline";
import ExploreIcon from "@mui/icons-material/Explore";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { usePortalSession } from "@/components/portal/PortalSessionProvider";
import ActivitySubItems, {
  activityItemsKey,
  useActivityItems,
} from "@/components/portal/ActivitySubItems";
import ActivityItemDialog from "@/components/portal/ActivityItemDialog";
import { listCohorts } from "@/lib/portal/store";
import { portalCopy } from "@/data/portalCopy";
import type { ActivityItem } from "@/types/portal";
import {
  formatRange,
  TIMELINE_COHORT_ID,
  timelineRows,
  type TimelineRow,
} from "@/data/activityTimeline";

type Section = {
  key: "files" | "main" | "side";
  label: string;
  icon: React.ReactNode;
};

const sections: Section[] = [
  { key: "files", label: portalCopy.activities.sections.files, icon: <DescriptionIcon color="secondary" /> },
  { key: "main", label: portalCopy.activities.sections.main, icon: <TimelineIcon color="secondary" /> },
  { key: "side", label: portalCopy.activities.sections.side, icon: <ExploreIcon color="secondary" /> },
];

const importantFiles = [
  {
    title: "2026 秋季她行活动 Mentor 守则",
    href: "/documents/2026-fall-mentor-guide.pdf",
  },
  {
    title: "2026 秋季她行活动 Mentee 守则",
    href: "/documents/2026-fall-mentee-guide.pdf",
  },
];

export default function ActivitiesPage() {
  const { currentUser, realUser } = usePortalSession();
  const queryClient = useQueryClient();
  const { data: cohorts } = useQuery({ queryKey: ["portal", "cohorts"], queryFn: listCohorts });

  const myCohorts = (cohorts ?? []).filter((c) =>
    currentUser?.cohort_ids.includes(c.id),
  );
  // The timeline below is pinned to one season, and so are its 子活动 — not
  // the newest cohort, which changes the moment the next season is created.
  const timelineCohortId = cohorts?.some((c) => c.id === TIMELINE_COHORT_ID)
    ? TIMELINE_COHORT_ID
    : undefined;
  const { items: subItems, canEdit, now } = useActivityItems(timelineCohortId);

  const [dialog, setDialog] = React.useState<{
    parent: TimelineRow;
    item: ActivityItem | null;
  } | null>(null);
  // Kept apart from `dialog` so the title does not change while it fades out.
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const openDialog = (parent: TimelineRow, item: ActivityItem | null) => {
    setDialog({ parent, item });
    setDialogOpen(true);
  };

  return (
    <Box sx={{ maxWidth: 880 }}>
      <Typography variant="h4" fontWeight={800} gutterBottom>
        {portalCopy.activities.title}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 1 }}>
        {portalCopy.activities.subtitle}
      </Typography>
      <Typography fontWeight={700} color="primary.dark" sx={{ mb: 1 }}>
        2026 秋季项目时间线 · 2026年10月11日 – 2026年12月6日
      </Typography>
      {myCohorts.length > 0 && (
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          所在项目：{myCohorts.map((c) => c.name).join("、")}
        </Typography>
      )}

      <Stack spacing={3}>
        {sections.map((section) => (
          <Paper key={section.key} sx={{ p: 3, borderRadius: 3 }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              {section.icon}
              <Typography variant="h6" fontWeight={700}>
                {section.label}
              </Typography>
            </Stack>
            <Divider sx={{ my: 2 }} />
            {section.key === "files" ? (
              <Stack spacing={1.5}>
                {importantFiles.map((file) => (
                  <Stack
                    key={file.href}
                    direction={{ xs: "column", sm: "row" }}
                    justifyContent="space-between"
                    alignItems={{ xs: "flex-start", sm: "center" }}
                    spacing={1.5}
                    sx={{
                      p: 2,
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 2,
                      bgcolor: "#fffaf2",
                    }}
                  >
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <PictureAsPdfOutlinedIcon color="secondary" />
                      <Typography fontWeight={700}>{file.title}</Typography>
                    </Stack>
                    <Button
                      component="a"
                      href={file.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="outlined"
                      color="secondary"
                      endIcon={<OpenInNewIcon />}
                    >
                      查看 PDF
                    </Button>
                  </Stack>
                ))}
              </Stack>
            ) : (
              <Stack spacing={1.5}>
                {timelineRows
                  .filter((activity) => activity.track === section.key)
                  .map((activity) => (
                    <Box
                      key={activity.key}
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        bgcolor: section.key === "main" ? "#fff7e8" : "#f8fafc",
                        border: "1px solid",
                        borderColor: section.key === "main" ? "#fbd9a3" : "divider",
                      }}
                    >
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        justifyContent="space-between"
                        alignItems={{ xs: "flex-start", sm: "center" }}
                        spacing={1}
                      >
                        <Box>
                          <Typography fontWeight={700}>{activity.title}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {formatRange(activity.from, activity.to)}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Chip
                            size="small"
                            label={activity.week}
                            color={section.key === "main" ? "primary" : "default"}
                          />
                          {canEdit && (
                            <Tooltip title={portalCopy.activities.subItems.add}>
                              <IconButton
                                size="small"
                                color="secondary"
                                aria-label={portalCopy.activities.subItems.add}
                                onClick={() => openDialog(activity, null)}
                              >
                                <AddIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Stack>
                      </Stack>
                      <ActivitySubItems
                        items={subItems.filter((i) => i.parent_key === activity.key)}
                        canEdit={canEdit}
                        now={now}
                        onEdit={(item) => openDialog(activity, item)}
                      />
                    </Box>
                  ))}
              </Stack>
            )}
          </Paper>
        ))}
      </Stack>

      {canEdit && timelineCohortId && realUser && dialog && (
        <ActivityItemDialog
          open={dialogOpen}
          item={dialog.item}
          parent={dialog.parent}
          cohortId={timelineCohortId}
          createdBy={realUser.id}
          onClose={() => setDialogOpen(false)}
          onSaved={() => {
            setDialogOpen(false);
            void queryClient.invalidateQueries({ queryKey: activityItemsKey(timelineCohortId) });
          }}
        />
      )}
    </Box>
  );
}
