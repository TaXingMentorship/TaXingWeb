"use client";

import { useQuery } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { MyTask } from "@/types/portal";
import { listMyTasks, setMyTaskDone } from "@/lib/portal/store";
import { usePortalSession } from "@/components/portal/PortalSessionProvider";

export const MY_TASKS_KEY = ["portal", "myTasks"] as const;

/**
 * The signed-in user's task assignments, shared by the sidebar badge, the
 * home-page reminder and /portal/tasks so all three agree on the count.
 * Keyed on the real account: tasks are not a persona thing.
 */
export function useMyTasks() {
  const { realUser } = usePortalSession();
  const query = useQuery({
    queryKey: [...MY_TASKS_KEY, realUser?.id],
    queryFn: () => listMyTasks(realUser!.id),
    enabled: Boolean(realUser),
  });
  const tasks = query.data ?? [];
  return {
    ...query,
    tasks,
    pending: tasks.filter((item) => !item.completed_at),
    done: tasks.filter((item) => Boolean(item.completed_at)),
    hasUnseen: tasks.some((item) => taskBadge(item) !== null),
  };
}

export type TaskBadge = "new" | "updated";

/**
 * 新任务 until she first opens 我的任务, 已更新 when the task was edited (or
 * re-sent) after she last did. Independent of completion: a finished task can
 * still be 已更新.
 */
export function taskBadge(item: MyTask): TaskBadge | null {
  if (!item.seen_at) return "new";
  return item.seen_at < item.notified_at ? "updated" : null;
}

/** Past its due date and still open. Compares calendar days, not timestamps. */
export function isOverdue(item: MyTask): boolean {
  if (item.completed_at || !item.task.due_on) return false;
  return new Date(item.task.due_on) < new Date(new Date().toDateString());
}

/**
 * Completes every pending task that points at `path` — used by the page a
 * task links to, so saving there closes the reminder without a second trip to
 * 我的任务. Failures are swallowed: the save itself already succeeded, and the
 * task can still be closed by hand.
 */
export function useCompleteTasksLinkingTo(path: string) {
  const queryClient = useQueryClient();
  const { pending } = useMyTasks();
  const mutation = useMutation({
    mutationFn: async () => {
      const targets = pending.filter((item) => item.task.link === path);
      await Promise.all(targets.map((item) => setMyTaskDone(item.id, true)));
      return targets.length;
    },
    onSuccess: (count) => {
      if (count > 0) queryClient.invalidateQueries({ queryKey: MY_TASKS_KEY });
    },
  });
  return () => {
    if (pending.some((item) => item.task.link === path)) mutation.mutate();
  };
}
