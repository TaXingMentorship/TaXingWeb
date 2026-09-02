"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Stack from "@mui/material/Stack";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import Select from "@mui/material/Select";
import InputLabel from "@mui/material/InputLabel";
import FormControl from "@mui/material/FormControl";
import OutlinedInput from "@mui/material/OutlinedInput";
import type { SelectChangeEvent } from "@mui/material/Select";
import type { BulletinBoard, BulletinCategory } from "@/types/portal";
import { createBoard } from "@/lib/portal/store";
import { allCategories, categoryLabels, portalCopy } from "@/data/portalCopy";

export default function BoardTabs({
  boards,
  counts,
  selectedId,
  onSelect,
}: {
  boards: BulletinBoard[];
  counts: Record<string, number>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
      <Tabs
        value={selectedId ?? false}
        onChange={(_, value: string) => onSelect(value)}
        variant="scrollable"
        scrollButtons="auto"
        textColor="secondary"
        indicatorColor="secondary"
        sx={{ "& .MuiTab-root": { minHeight: 56, px: 2.5, textTransform: "none" } }}
      >
        {boards.map((board) => (
          <Tab
            key={board.id}
            value={board.id}
            label={
              // Inline chips rather than an absolutely positioned Badge — the
              // Badge overflowed the Tab box and its count got clipped.
              <Stack direction="row" spacing={0.75} alignItems="center">
                <Box component="span">{board.name}</Box>
                <Chip
                  size="small"
                  color="secondary"
                  label={counts[board.id] ?? 0}
                  sx={{
                    height: 20,
                    minWidth: 20,
                    fontSize: 11,
                    "& .MuiChip-label": { px: 0.75 },
                  }}
                />
                {!board.is_open && (
                  <Chip
                    size="small"
                    label={portalCopy.board.closed}
                    sx={{ height: 20, fontSize: 11 }}
                  />
                )}
              </Stack>
            }
          />
        ))}
      </Tabs>
    </Box>
  );
}

export function CreateBoardDialog({
  open,
  cohortId,
  onClose,
  onCreated,
}: {
  open: boolean;
  /** The season currently selected in SeasonTabs — the new board joins it. */
  cohortId: string;
  onClose: () => void;
  onCreated: (board: BulletinBoard) => void;
}) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [prompt, setPrompt] = React.useState("");
  const [isOpen, setIsOpen] = React.useState(true);
  const [allowAnonymous, setAllowAnonymous] = React.useState(true);
  const [allowComments, setAllowComments] = React.useState(true);
  const [categories, setCategories] = React.useState<BulletinCategory[]>([]);

  React.useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
    setPrompt("");
    setIsOpen(true);
    setAllowAnonymous(true);
    setAllowComments(true);
    setCategories([]);
  }, [open]);

  const mutation = useMutation({
    mutationFn: () =>
      createBoard({
        cohort_id: cohortId,
        name: name.trim(),
        description: description.trim() || null,
        prompt: prompt.trim() || null,
        is_open: isOpen,
        allow_anonymous: allowAnonymous,
        allow_comments: allowComments,
        allowed_categories: categories.length > 0 ? categories : null,
        // Tab order is not worth a form field — every board is created at 0,
        // so listBoards falls through to created_at. Adjust in Supabase if a
        // board ever needs to jump the queue.
        sort_order: 0,
      }),
    onSuccess: onCreated,
  });

  const handleCategories = (event: SelectChangeEvent<BulletinCategory[]>) => {
    const value = event.target.value;
    setCategories(
      typeof value === "string" ? (value.split(",") as BulletinCategory[]) : value,
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{portalCopy.board.createTitle}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {mutation.isError && (
            <Alert severity="error">{(mutation.error as Error).message}</Alert>
          )}
          <TextField
            label={portalCopy.board.nameLabel}
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            autoFocus
          />
          <TextField
            label={portalCopy.board.descriptionLabel}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            minRows={2}
          />
          <TextField
            label={portalCopy.board.promptLabel}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            fullWidth
            multiline
            minRows={2}
          />
          <FormControl fullWidth>
            <InputLabel id="board-categories-label">
              {portalCopy.board.categoriesLabel}
            </InputLabel>
            <Select
              labelId="board-categories-label"
              multiple
              value={categories}
              onChange={handleCategories}
              input={<OutlinedInput label={portalCopy.board.categoriesLabel} />}
              renderValue={(selected) => (
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {selected.map((c) => (
                    <Chip key={c} size="small" label={categoryLabels[c]} />
                  ))}
                </Stack>
              )}
            >
              {allCategories.map((c) => (
                <MenuItem key={c} value={c}>
                  {categoryLabels[c]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControlLabel
            control={
              <Switch
                checked={isOpen}
                onChange={(e) => setIsOpen(e.target.checked)}
              />
            }
            label={portalCopy.board.openLabel}
          />
          <FormControlLabel
            control={
              <Switch
                checked={allowAnonymous}
                onChange={(e) => setAllowAnonymous(e.target.checked)}
              />
            }
            label={portalCopy.board.allowAnonymousLabel}
          />
          <FormControlLabel
            control={
              <Switch
                checked={allowComments}
                onChange={(e) => setAllowComments(e.target.checked)}
              />
            }
            label={portalCopy.board.allowCommentsLabel}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{portalCopy.board.cancel}</Button>
        <Button
          variant="contained"
          color="secondary"
          disabled={!name.trim() || !cohortId || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          创建
        </Button>
      </DialogActions>
    </Dialog>
  );
}
