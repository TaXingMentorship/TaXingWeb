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
import Tooltip from "@mui/material/Tooltip";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import type { SelectChangeEvent } from "@mui/material/Select";
import type { BulletinBoard, BulletinCategory, Cohort } from "@/types/portal";
import { createBoard, updateBoard } from "@/lib/portal/store";
import { allCategories, categoryLabels, portalCopy } from "@/data/portalCopy";

export default function BoardTabs({
  boards,
  counts,
  selectedId,
  onSelect,
  onEdit,
}: {
  boards: BulletinBoard[];
  counts: Record<string, number>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Admin only. Shows a pencil on the selected tab that opens the editor. */
  onEdit?: (board: BulletinBoard) => void;
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
                {onEdit && board.id === selectedId && (
                  // A <span role="button"> rather than IconButton: the Tab is
                  // already a <button>, and buttons cannot nest.
                  <Tooltip title={portalCopy.board.editButton}>
                    <Box
                      component="span"
                      role="button"
                      tabIndex={0}
                      aria-label={portalCopy.board.editButton}
                      onClick={(event: React.MouseEvent) => {
                        event.stopPropagation();
                        onEdit(board);
                      }}
                      onKeyDown={(event: React.KeyboardEvent) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          event.stopPropagation();
                          onEdit(board);
                        }
                      }}
                      sx={{
                        display: "inline-flex",
                        color: "text.secondary",
                        borderRadius: 1,
                        "&:hover, &:focus-visible": { color: "secondary.main" },
                      }}
                    >
                      <EditOutlinedIcon sx={{ fontSize: 16 }} />
                    </Box>
                  </Tooltip>
                )}
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

/** Shared by create and edit — `board` null means create. */
export function BoardDialog({
  open,
  board,
  cohortId,
  cohorts,
  onClose,
  onSaved,
  onDelete,
}: {
  open: boolean;
  board: BulletinBoard | null;
  /** The season selected in SeasonTabs — the initial choice, not the only one. */
  cohortId: string;
  /**
   * Every season, including those with no boards yet.
   *
   * The season row only lists seasons that already have a board, so it cannot
   * be the control that decides where a *new* board goes — the first board of a
   * season would be impossible to create. Those are two different questions
   * ("which season am I reading" vs "which season is this board for") and they
   * get two different controls.
   */
  cohorts: Cohort[];
  onClose: () => void;
  onSaved: (board: BulletinBoard) => void;
  /** Edit mode only: hands the board to the page's delete confirmation. */
  onDelete: (board: BulletinBoard) => void;
}) {
  const [targetCohortId, setTargetCohortId] = React.useState(cohortId);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [prompt, setPrompt] = React.useState("");
  const [isOpen, setIsOpen] = React.useState(true);
  const [allowAnonymous, setAllowAnonymous] = React.useState(true);
  const [allowComments, setAllowComments] = React.useState(true);
  const [categories, setCategories] = React.useState<BulletinCategory[]>([]);

  React.useEffect(() => {
    if (!open) return;
    setName(board?.name ?? "");
    setDescription(board?.description ?? "");
    setPrompt(board?.prompt ?? "");
    setIsOpen(board?.is_open ?? true);
    setAllowAnonymous(board?.allow_anonymous ?? true);
    setAllowComments(board?.allow_comments ?? true);
    setCategories(board?.allowed_categories ?? []);
    setTargetCohortId(board?.cohort_id ?? cohortId);
  }, [open, board, cohortId]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        prompt: prompt.trim() || null,
        is_open: isOpen,
        allow_anonymous: allowAnonymous,
        allow_comments: allowComments,
        allowed_categories: categories.length > 0 ? categories : null,
      };
      // The season is fixed once a board exists — see updateBoard.
      return board
        ? updateBoard(board.id, payload)
        : createBoard({
            ...payload,
            cohort_id: targetCohortId,
            // Tab order is not worth a form field — every board is created
            // at 0, so listBoards falls through to created_at. Adjust in
            // Supabase if a board ever needs to jump the queue.
            sort_order: 0,
          });
    },
    onSuccess: onSaved,
  });

  const handleCategories = (event: SelectChangeEvent<BulletinCategory[]>) => {
    const value = event.target.value;
    setCategories(
      typeof value === "string" ? (value.split(",") as BulletinCategory[]) : value,
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {board ? portalCopy.board.editTitle : portalCopy.board.createTitle}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {mutation.isError && (
            <Alert severity="error">{(mutation.error as Error).message}</Alert>
          )}
          <TextField
            select
            label={portalCopy.board.seasonLabel}
            value={targetCohortId}
            onChange={(event) => setTargetCohortId(event.target.value)}
            helperText={
              board
                ? portalCopy.board.editSeasonHelp
                : portalCopy.board.createSeasonHelp
            }
            disabled={Boolean(board)}
            fullWidth
          >
            {cohorts.map((cohort) => (
              <MenuItem key={cohort.id} value={cohort.id}>
                {cohort.name}
              </MenuItem>
            ))}
          </TextField>
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
        {board && (
          <Button
            color="error"
            disabled={mutation.isPending}
            onClick={() => onDelete(board)}
            sx={{ mr: "auto" }}
          >
            {portalCopy.board.deleteButton}
          </Button>
        )}
        <Button onClick={onClose}>{portalCopy.board.cancel}</Button>
        <Button
          variant="contained"
          color="secondary"
          disabled={!name.trim() || !targetCohortId || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {board ? portalCopy.board.saveAction : portalCopy.board.createAction}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
