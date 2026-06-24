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
import Alert from "@mui/material/Alert";
import GroupsIcon from "@mui/icons-material/Groups";
import PersonIcon from "@mui/icons-material/Person";
import ForumIcon from "@mui/icons-material/Forum";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import InsightsIcon from "@mui/icons-material/Insights";
import { usePortalSession } from "@/components/portal/PortalSessionProvider";
import { listCohorts } from "@/lib/portal/store";
import { roleLabels } from "@/data/portalCopy";
import type { UserRole } from "@/types/portal";

type Tile = {
  label: string;
  description: string;
  path: string;
  icon: React.ReactNode;
  roles: UserRole[];
};

const tiles: Tile[] = [
  {
    label: "成员目录",
    description: "浏览本期的导师与学员，按兴趣搜索。",
    path: "/portal/directory",
    icon: <GroupsIcon fontSize="large" color="secondary" />,
    roles: ["admin", "mentor", "mentee"],
  },
  {
    label: "我的资料",
    description: "完善个人资料，查看我的辅导记录。",
    path: "/portal/me",
    icon: <PersonIcon fontSize="large" color="secondary" />,
    roles: ["admin", "mentor", "mentee"],
  },
  {
    label: "留言板",
    description: "发布求助、感谢与成长打卡。",
    path: "/portal/board",
    icon: <ForumIcon fontSize="large" color="secondary" />,
    roles: ["admin", "mentor", "mentee"],
  },
  {
    label: "名单导入",
    description: "上传 CSV 批量导入导师与学员。",
    path: "/portal/admin/import",
    icon: <UploadFileIcon fontSize="large" color="secondary" />,
    roles: ["admin"],
  },
  {
    label: "进度跟踪",
    description: "记录辅导场次，查看配对进度统计。",
    path: "/portal/admin/sessions",
    icon: <InsightsIcon fontSize="large" color="secondary" />,
    roles: ["admin"],
  },
];

export default function PortalHomePage() {
  const { currentUser } = usePortalSession();
  const { data: cohorts } = useQuery({ queryKey: ["portal", "cohorts"], queryFn: listCohorts });

  const role = currentUser?.role;
  const myCohorts = (cohorts ?? []).filter((c) =>
    currentUser?.cohort_ids.includes(c.id),
  );
  const visibleTiles = tiles.filter((t) => role && t.roles.includes(role));

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
        <Avatar src={currentUser?.avatar_url ?? undefined} sx={{ width: 56, height: 56 }} />
        <Box>
          <Typography variant="h4" fontWeight={800}>
            欢迎回来，{currentUser?.full_name}
          </Typography>
          <Typography color="text.secondary">
            身份：{role ? roleLabels[role] : ""}
          </Typography>
        </Box>
      </Stack>

      {myCohorts.length > 0 && (
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          所在项目：{myCohorts.map((c) => c.name).join("、")}
        </Typography>
      )}

      <Alert severity="info" sx={{ mb: 3 }}>
        这是一个交互式原型，使用示例数据，所有改动只保存在你的浏览器中。可用右下角的「演示身份」切换管理员、导师、学员视角。
      </Alert>

      <Grid container spacing={2}>
        {visibleTiles.map((tile) => (
          <Grid key={tile.path} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card sx={{ height: "100%", borderRadius: 3 }}>
              <CardActionArea component={Link} href={tile.path} sx={{ height: "100%" }}>
                <CardContent>
                  <Stack spacing={1.5}>
                    {tile.icon}
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
