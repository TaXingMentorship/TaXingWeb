"use client";

import * as React from "react";
import Link from "next/link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { portalCopy } from "@/data/portalCopy";
import { isOverdue, useMyTasks } from "@/components/portal/useMyTasks";

const PREVIEW_LIMIT = 3;

/** The 待办提醒 strip at the top of the portal home. Renders nothing when there is nothing to do. */
export default function TaskReminderCard() {
  const copy = portalCopy.tasks;
  const { pending } = useMyTasks();
  if (pending.length === 0) return null;

  return (
    <Paper
      sx={{
        p: 2.5,
        mb: 3,
        borderRadius: 3,
        borderLeft: 4,
        borderColor: "secondary.main",
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={1}
        sx={{ mb: 1.5 }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <NotificationsActiveIcon color="secondary" />
          <Typography variant="h6" fontWeight={700}>
            {copy.reminderTitle}
          </Typography>
          <Typography color="text.secondary">{copy.reminderCount(pending.length)}</Typography>
        </Stack>
        <Button component={Link} href="/portal/tasks" size="small" endIcon={<ArrowForwardIcon />}>
          {copy.reminderAll}
        </Button>
      </Stack>
      <Stack spacing={1}>
        {pending.slice(0, PREVIEW_LIMIT).map((item) => (
          <Stack
            key={item.id}
            direction="row"
            spacing={1.5}
            alignItems="center"
            justifyContent="space-between"
          >
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography fontWeight={600} noWrap>
                  {item.task.title}
                </Typography>
                {isOverdue(item) && <Chip size="small" color="error" label={copy.overdue} />}
              </Stack>
              {item.task.due_on && (
                <Typography variant="caption" color="text.secondary">
                  {copy.dueOn(new Date(item.task.due_on).toLocaleDateString("zh-CN"))}
                </Typography>
              )}
            </Box>
            <Button
              component={Link}
              href={item.task.link ?? "/portal/tasks"}
              size="small"
              variant="outlined"
              sx={{ flexShrink: 0 }}
            >
              {copy.go}
            </Button>
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}
