"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import DescriptionIcon from "@mui/icons-material/Description";
import TimelineIcon from "@mui/icons-material/Timeline";
import ExploreIcon from "@mui/icons-material/Explore";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { usePortalSession } from "@/components/portal/PortalSessionProvider";
import { listCohorts } from "@/lib/portal/store";
import { portalCopy } from "@/data/portalCopy";

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

type Activity = {
  week: string;
  dates: string;
  title: string;
  track: "main" | "side";
};

const activities: Activity[] = [
  { week: "Week 0–1", dates: "10月10日 – 10月18日", title: "成员破冰", track: "main" },
  { week: "Week 0–1", dates: "10月10日 – 10月18日", title: "自主培训", track: "main" },
  { week: "Week 2–3", dates: "10月19日 – 11月1日", title: "Mentor 答疑组活动", track: "main" },
  { week: "Week 4", dates: "11月2日 – 11月8日", title: "Mentor–Mentee 1v1 配对", track: "main" },
  { week: "Week 4", dates: "11月2日 – 11月8日", title: "圆桌分享会", track: "side" },
  { week: "Week 5–7", dates: "11月9日 – 11月29日", title: "Mentor–Mentee 1v1 交流", track: "main" },
  { week: "Week 5–8", dates: "11月9日 – 12月6日", title: "Office Hour 活动", track: "side" },
  { week: "Week 5–7", dates: "11月9日 – 11月29日", title: "圆桌分享会", track: "side" },
  { week: "Week 8", dates: "11月30日 – 12月6日", title: "毕业活动", track: "side" },
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
  const { currentUser } = usePortalSession();
  const { data: cohorts } = useQuery({ queryKey: ["portal", "cohorts"], queryFn: listCohorts });

  const myCohorts = (cohorts ?? []).filter((c) =>
    currentUser?.cohort_ids.includes(c.id),
  );

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
                {activities
                  .filter((activity) => activity.track === section.key)
                  .map((activity) => (
                    <Box
                      key={`${activity.week}-${activity.title}`}
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
                            {activity.dates}
                          </Typography>
                        </Box>
                        <Chip
                          size="small"
                          label={activity.week}
                          color={section.key === "main" ? "primary" : "default"}
                        />
                      </Stack>
                    </Box>
                  ))}
              </Stack>
            )}
          </Paper>
        ))}
      </Stack>
    </Box>
  );
}
