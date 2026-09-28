"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { setMyTaskDone } from "@/lib/portal/store";
import { portalCopy } from "@/data/portalCopy";
import { MY_TASKS_KEY, isOverdue, useMyTasks } from "@/components/portal/useMyTasks";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("zh-CN");
}

export default function MyTasksPage() {
  const copy = portalCopy.tasks;
  const queryClient = useQueryClient();
  const { pending, done, isLoading } = useMyTasks();
  const [tab, setTab] = React.useState<"pending" | "done">("pending");

  const mutation = useMutation({
    mutationFn: ({ id, isDone }: { id: string; isDone: boolean }) =>
      setMyTaskDone(id, isDone),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MY_TASKS_KEY }),
  });

  const items = tab === "pending" ? pending : done;

  return (
    <Box>
      <Typography variant="h4" fontWeight={800} gutterBottom>
        {copy.title}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {copy.subtitle}
      </Typography>

      <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ mb: 2 }}>
        <Tab value="pending" label={`${copy.pendingTab}（${pending.length}）`} />
        <Tab value="done" label={`${copy.doneTab}（${done.length}）`} />
      </Tabs>

      {mutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {mutation.error instanceof Error ? mutation.error.message : "更新任务失败。"}
        </Alert>
      )}

      {isLoading ? (
        <Typography color="text.secondary">{copy.loading}</Typography>
      ) : items.length === 0 ? (
        <Typography color="text.secondary">
          {tab === "pending" ? copy.empty : copy.emptyDone}
        </Typography>
      ) : (
        <Stack spacing={2}>
          {items.map((item) => (
            <Paper key={item.id} sx={{ p: 2.5, borderRadius: 3 }}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                justifyContent="space-between"
                alignItems={{ xs: "stretch", sm: "flex-start" }}
              >
                <Box sx={{ flexGrow: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography variant="h6" fontWeight={700}>
                      {item.task.title}
                    </Typography>
                    {item.task.due_on && !item.completed_at && (
                      <Chip
                        size="small"
                        color={isOverdue(item) ? "error" : "default"}
                        label={
                          isOverdue(item)
                            ? `${copy.overdue} · ${copy.dueOn(formatDate(item.task.due_on))}`
                            : copy.dueOn(formatDate(item.task.due_on))
                        }
                      />
                    )}
                    {item.completed_at && (
                      <Chip
                        size="small"
                        color="success"
                        icon={<CheckCircleOutlineIcon />}
                        label={copy.completedAt(formatDate(item.completed_at))}
                      />
                    )}
                  </Stack>
                  {item.task.description && (
                    <Typography color="text.secondary" sx={{ mt: 1, whiteSpace: "pre-wrap" }}>
                      {item.task.description}
                    </Typography>
                  )}
                </Box>
                <Stack direction="row" spacing={1} flexShrink={0}>
                  {item.task.link && !item.completed_at && (
                    <Button
                      component={Link}
                      href={item.task.link}
                      variant="outlined"
                      endIcon={<ArrowForwardIcon />}
                    >
                      {copy.go}
                    </Button>
                  )}
                  <Button
                    variant={item.completed_at ? "text" : "contained"}
                    color="secondary"
                    disabled={mutation.isPending}
                    onClick={() =>
                      mutation.mutate({ id: item.id, isDone: !item.completed_at })
                    }
                  >
                    {item.completed_at ? copy.reopen : copy.markDone}
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}
    </Box>
  );
}
