"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Avatar from "@mui/material/Avatar";
import { usePortalSession } from "@/components/portal/PortalSessionProvider";
import { listCohorts } from "@/lib/portal/store";
import { profileLabels } from "@/data/portalCopy";
import { canAccessPortalNav, portalNavItems } from "@/data/portalNav";

export default function PortalHomePage() {
  const { currentUser } = usePortalSession();
  const { data: cohorts } = useQuery({ queryKey: ["portal", "cohorts"], queryFn: listCohorts });

  const myCohorts = (cohorts ?? []).filter((c) =>
    currentUser?.cohort_ids.includes(c.id),
  );
  const visibleTiles = portalNavItems.filter(
    (tile) => tile.showOnHome !== false && canAccessPortalNav(tile, currentUser),
  );

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
        <Avatar src={currentUser?.avatar_url ?? undefined} sx={{ width: 56, height: 56 }} />
        <Box>
          <Typography variant="h4" fontWeight={800}>
            欢迎回来，{currentUser?.full_name}
          </Typography>
          <Typography color="text.secondary">
            身份：{currentUser ? profileLabels(currentUser).join(" · ") : ""}
          </Typography>
        </Box>
      </Stack>

      {myCohorts.length > 0 && (
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          所在项目：{myCohorts.map((c) => c.name).join("、")}
        </Typography>
      )}

      <Grid container spacing={2}>
        {visibleTiles.map((tile) => (
          <Grid key={tile.path} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card sx={{ height: "100%", borderRadius: 3 }}>
              <CardActionArea component={Link} href={tile.path} sx={{ height: "100%" }}>
                <CardContent>
                  <Stack spacing={1.5}>
                    <tile.Icon fontSize="large" color="secondary" />
                    <Typography variant="h6" fontWeight={700}>
                      {tile.label}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {tile.description}
                    </Typography>
                  </Stack>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
