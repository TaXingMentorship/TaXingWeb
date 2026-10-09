"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Link from "@mui/material/Link";
import Collapse from "@mui/material/Collapse";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import type { BoardNotice, Profile } from "@/types/portal";
import {
  createBoardNotice,
  deleteBoardNotice,
  updateBoardNotice,
} from "@/lib/portal/store";
import { portalCopy } from "@/data/portalCopy";
import LinkifiedText from "./LinkifiedText";

const DISMISSED_KEY = "portal.board.dismissedNotices";

function readDismissed(): string[] {
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/**
 * 志愿者提醒 as dismissible bars, and the board's single 留言须知 as a
 * collapsible card. Admins and volunteers edit both (`board_notices_staff_all`,
 * migration 0028). Dismissal is a per-browser convenience only.
 */
export default function BoardNotices({
  boardId,
  notices,
  canEdit,
  currentUserId,
  authorOf,
}: {
  boardId: string;
  notices: BoardNotice[];
  canEdit: boolean;
  currentUserId: string;
  authorOf: (id: string) => Profile | undefined;
}) {
  const copy = portalCopy.board;
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = React.useState<string[]>([]);
  React.useEffect(() => setDismissed(readDismissed()), []);
  const [guideOpen, setGuideOpen] = React.useState(true);
  const [editor, setEditor] = React.useState<
    { kind: "guide" | "reminder"; notice: BoardNotice | null } | null
  >(null);
  const [draft, setDraft] = React.useState("");

  const now = Date.now();
  const reminders = notices.filter(
    (n) =>
      n.kind === "reminder" &&
      !n.group_id &&
      (!n.expires_at || new Date(n.expires_at).getTime() > now) &&
      (canEdit || !dismissed.includes(n.id)),
  );
  // One 留言须知 for the whole board — the same wording applies to every group.
  // `group_id` is ignored: guides written while they were still per-group (before
  // 0028's group_id was dropped from the UI) must keep showing, and notices are
  // listed newest first, so the latest guide wins.
  const guide = notices.find((n) => n.kind === "guide") ?? null;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["portal", "boardNotices"] });
  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = draft.trim();
      if (!editor || !body) return;
      if (editor.notice) await updateBoardNotice(editor.notice.id, body);
      else
        await createBoardNotice({
          board_id: boardId,
          group_id: null,
          kind: editor.kind,
          body,
          created_by: currentUserId,
        });
    },
    onSuccess: () => {
      setEditor(null);
      refresh();
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBoardNotice(id),
    onSuccess: refresh,
  });

  const openEditor = (kind: "guide" | "reminder", notice: BoardNotice | null) => {
    saveMutation.reset();
    setDraft(notice?.body ?? "");
    setEditor({ kind, notice });
  };

  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    try {
      window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
    } catch {
      // Private mode: the bar simply comes back next visit.
    }
  };

  if (!canEdit && reminders.length === 0 && !guide) return null;

  return (
    <Stack spacing={1.5} sx={{ mb: 2 }}>
      {reminders.map((notice) => {
        const poster = notice.created_by ? authorOf(notice.created_by) : undefined;
        return (
          <Alert
            key={notice.id}
            severity="warning"
            icon={false}
            action={
              <Stack direction="row" alignItems="center">
                {canEdit && (
                  <>
                    <IconButton size="small" aria-label={copy.noticeGuideEdit} onClick={() => openEditor("reminder", notice)}>
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label={copy.noticeDelete}
                      onClick={() => {
                        if (window.confirm(copy.deleteConfirm)) deleteMutation.mutate(notice.id);
                      }}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </>
                )}
                <IconButton size="small" aria-label={copy.noticeDismiss} onClick={() => dismiss(notice.id)}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Stack>
            }
          >
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              <b>
                {copy.noticeReminderTitle}
                {poster?.full_name ? ` · ${poster.full_name}` : ""}
              </b>
              {"　"}
              <LinkifiedText text={notice.body} />
              <Typography component="span" variant="caption" color="text.secondary">
                {"　"}
                {new Date(notice.created_at).toLocaleDateString("zh-CN")}
              </Typography>
            </Typography>
          </Alert>
        );
      })}

      {(guide || canEdit) && (
        <Paper variant="outlined" sx={{ borderRadius: 2 }}>
          <Stack direction="row" alignItems="center" sx={{ pr: 1 }}>
            <ButtonBase
              onClick={() => setGuideOpen((open) => !open)}
              aria-expanded={guideOpen}
              sx={{
                fontFamily: "inherit",
                flexGrow: 1,
                justifyContent: "flex-start",
                gap: 1,
                px: 1.5,
                py: 1,
                textAlign: "left",
                fontWeight: 700,
                fontSize: 14,
                borderRadius: 2,
              }}
            >
              <InfoOutlinedIcon fontSize="small" color="secondary" />
              <Box sx={{ flexGrow: 1 }}>{copy.noticeGuideTitle}</Box>
              <ExpandMoreIcon
                fontSize="small"
                sx={{ transform: guideOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }}
              />
            </ButtonBase>
            {canEdit && (
              <Link
                component="button"
                type="button"
                variant="body2"
                underline="hover"
                color="secondary.dark"
                onClick={() => openEditor("guide", guide)}
                sx={{ ml: 1, whiteSpace: "nowrap" }}
              >
                {copy.noticeGuideEdit}
              </Link>
            )}
          </Stack>
          <Collapse in={guideOpen}>
            <Box sx={{ px: 1.5, pb: 1.5 }}>
              {guide ? (
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  <LinkifiedText text={guide.body} />
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {copy.noticeGuideEmpty}
                </Typography>
              )}
            </Box>
          </Collapse>
        </Paper>
      )}

      {canEdit && (
        <Box>
          <Link
            component="button"
            type="button"
            variant="body2"
            underline="hover"
            color="secondary.dark"
            onClick={() => openEditor("reminder", null)}
          >
            + {copy.noticeReminderAdd}
          </Link>
        </Box>
      )}

      <Dialog open={Boolean(editor)} onClose={() => setEditor(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editor?.kind === "guide" ? copy.noticeGuideTitle : copy.noticeReminderTitle}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {saveMutation.isError && (
              <Alert severity="error">{(saveMutation.error as Error).message}</Alert>
            )}
            <TextField
              multiline
              minRows={4}
              autoFocus
              fullWidth
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 2000))}
              placeholder={
                editor?.kind === "guide" ? copy.noticeGuidePlaceholder : copy.noticeReminderPlaceholder
              }
              helperText={`${draft.length} / 2000`}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditor(null)}>{copy.cancel}</Button>
          <Button
            variant="contained"
            color="secondary"
            disabled={!draft.trim() || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {copy.noticeSave}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
