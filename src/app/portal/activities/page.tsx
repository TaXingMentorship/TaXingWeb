"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import DescriptionIcon from "@mui/icons-material/Description";
import TimelineIcon from "@mui/icons-material/Timeline";
import ExploreIcon from "@mui/icons-material/Explore";
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
            <Typography color="text.secondary">
              {portalCopy.activities.empty}
            </Typography>
          </Paper>
        ))}
      </Stack>
    </Box>
  );
}
