"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import type { MentorGroup } from "@/types/portal";
import {
  createMentorGroup,
  deleteMentorGroup,
  updateMentorGroup,
} from "@/lib/portal/store";
import { portalCopy } from "@/data/portalCopy";

/**
 * Admin editor for one season's mentor answer groups. Name, 方向 and order save
 * when a field loses focus; deleting a group unseats its mentors and leaves its
 * posts in place, ungrouped.
 */
export default function MentorGroupsDialog({
  open,
  cohortId,
  groups,
  memberCounts,
  onClose,
}: {
  open: boolean;
  cohortId: string;
  groups: MentorGroup[];
  /** mentors per group id, shown so a delete is not a surprise */
  memberCounts: Record<string, number>;
  onClose: () => void;
}) {
  const copy = portalCopy.mentorGroups;
  const queryClient = useQueryClient();
  const [direction, setDirection] = React.useState("");
  const [name, setName] = React.useState("");

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["portal", "mentorGroups"] });
    queryClient.invalidateQueries({ queryKey: ["portal", "mentorGroupMembers"] });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      createMentorGroup({
        cohort_id: cohortId,
        direction: direction.trim() || null,
        name: name.trim(),
        sort_order: groups.length,
      }),
    onSuccess: () => {
      setName("");
      refresh();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (input: {
      id: string;
      patch: Partial<Pick<MentorGroup, "direction" | "name" | "sort_order">>;
    }) => updateMentorGroup(input.id, input.patch),
    onSuccess: refresh,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteMentorGroup(id),
    onSuccess: refresh,
  });

  const error = [createMutation.error, updateMutation.error, deleteMutation.error].find(
    Boolean,
  ) as Error | undefined;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{copy.dialogTitle}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {copy.dialogHint}
          </Typography>
          {error && <Alert severity="error">{error.message}</Alert>}

          <Stack spacing={1}>
            {groups.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                {copy.none}
              </Typography>
            )}
            {groups.map((group) => (
              <GroupRow
                key={`${group.id}:${group.direction}:${group.name}:${group.sort_order}`}
                group={group}
                count={memberCounts[group.id] ?? 0}
                onPatch={(patch) => updateMutation.mutate({ id: group.id, patch })}
                onDelete={() => {
                  if (window.confirm(copy.deleteConfirm(group.name, memberCounts[group.id] ?? 0))) {
                    deleteMutation.mutate(group.id);
                  }
                }}
              />
            ))}
          </Stack>

          <Stack direction="row" spacing={1} alignItems="flex-start">
            <TextField
              size="small"
              label={copy.directionLabel}
              placeholder={copy.directionPlaceholder}
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              sx={{ width: 140 }}
            />
            <TextField
              size="small"
              label={copy.nameLabel}
              placeholder={copy.namePlaceholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
              sx={{ flexGrow: 1 }}
            />
            <Button
              variant="contained"
              color="secondary"
              disabled={!name.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {copy.add}
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{copy.close}</Button>
      </DialogActions>
    </Dialog>
  );
}

function GroupRow({
  group,
  count,
  onPatch,
  onDelete,
}: {
  group: MentorGroup;
  count: number;
  onPatch: (patch: Partial<Pick<MentorGroup, "direction" | "name" | "sort_order">>) => void;
  onDelete: () => void;
}) {
  const copy = portalCopy.mentorGroups;
  const [direction, setDirection] = React.useState(group.direction ?? "");
  const [name, setName] = React.useState(group.name);
  const [order, setOrder] = React.useState(String(group.sort_order));

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <TextField
        size="small"
        label={copy.directionLabel}
        value={direction}
        onChange={(e) => setDirection(e.target.value)}
        onBlur={() => {
          const next = direction.trim() || null;
          if (next !== group.direction) onPatch({ direction: next });
        }}
        sx={{ width: 120 }}
      />
      <TextField
        size="small"
        label={copy.nameLabel}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          const next = name.trim();
          if (!next) setName(group.name);
          else if (next !== group.name) onPatch({ name: next });
        }}
        sx={{ flexGrow: 1 }}
      />
      <TextField
        size="small"
        label={copy.orderLabel}
        value={order}
        onChange={(e) => setOrder(e.target.value.replace(/\D/g, ""))}
        onBlur={() => {
          const next = Number(order || 0);
          if (next !== group.sort_order) onPatch({ sort_order: next });
        }}
        sx={{ width: 72 }}
      />
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 44 }}>
        {copy.memberCount(count)}
      </Typography>
      <IconButton size="small" aria-label={copy.delete} onClick={onDelete}>
        <DeleteOutlineIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}
