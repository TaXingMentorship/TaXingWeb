"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import AnonymousAvatar from "@/components/portal/board/AnonymousAvatar";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import type { BulletinComment, Profile } from "@/types/portal";
import { portalCopy } from "@/data/portalCopy";
import { AuthorAvatar, AuthorName } from "./AuthorIdentity";
import LinkifiedText from "./LinkifiedText";

const MAX_COMMENT = 2000;

export default function PostComments({
  comments,
  authorOf,
  currentUserId,
  isAdmin,
  canComment,
  allowAnonymous,
  showMentorBadge = false,
  mentorMustBeNamed = false,
  pending,
  onSubmit,
  onDelete,
  onEdit,
  onToggleHidden,
  onOpenProfile,
}: {
  comments: BulletinComment[];
  authorOf: (id: string) => Profile | undefined;
  currentUserId: string | null;
  isAdmin: boolean;
  canComment: boolean;
  allowAnonymous: boolean;
  /** Q&A boards: label comments written by a (named) mentor. */
  showMentorBadge?: boolean;
  /** Q&A boards: the viewer is a mentor, whose comments must carry their name. */
  mentorMustBeNamed?: boolean;
  pending: boolean;
  onSubmit: (body: string, isAnonymous: boolean) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, body: string) => Promise<unknown>;
  onToggleHidden: (id: string, hidden: boolean) => void;
  onOpenProfile: (profile: Profile) => void;
}) {
  const [body, setBody] = React.useState("");
  const [anonymous, setAnonymous] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editBody, setEditBody] = React.useState("");
  const [editSaving, setEditSaving] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);

  const startEdit = (comment: BulletinComment) => {
    setEditingId(comment.id);
    setEditBody(comment.body);
    setEditError(null);
  };

  const saveEdit = async () => {
    const trimmed = editBody.trim();
    if (!editingId || !trimmed) return;
    setEditSaving(true);
    setEditError(null);
    try {
      await onEdit(editingId, trimmed);
      setEditingId(null);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : String(error));
    } finally {
      setEditSaving(false);
    }
  };

  const submit = () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    onSubmit(trimmed, allowAnonymous && !mentorMustBeNamed && anonymous);
    setBody("");
    setAnonymous(false);
  };

  return (
    <Box sx={{ mt: 1.5 }}>
      <Divider sx={{ mb: 1.5 }} />

      {comments.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {portalCopy.board.commentsEmpty}
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          {comments.map((comment) => {
            const author = comment.author_id
              ? authorOf(comment.author_id)
              : undefined;
            const isOwn = comment.author_id === currentUserId;
            const canDelete = isAdmin || isOwn;
            const editing = editingId === comment.id;
            return (
              <Stack
                key={comment.id}
                direction="row"
                spacing={1}
                alignItems="flex-start"
                sx={{ opacity: comment.hidden ? 0.6 : 1 }}
              >
                {comment.is_anonymous ? (
                  <AnonymousAvatar seed={comment.id} size={26} />
                ) : (
                  <AuthorAvatar author={author} size={26} onOpen={onOpenProfile} />
                )}
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Stack
                    direction="row"
                    spacing={0.75}
                    alignItems="center"
                    flexWrap="wrap"
                    useFlexGap
                  >
                    <AuthorName
                      author={author}
                      isAnonymous={comment.is_anonymous}
                      onOpen={onOpenProfile}
                    />
                    {showMentorBadge &&
                      !comment.is_anonymous &&
                      author?.participant_role === "mentor" && (
                        <Chip
                          size="small"
                          color="secondary"
                          label={portalCopy.board.mentorBadge}
                          sx={{ height: 18, fontSize: 11 }}
                        />
                      )}
                    {comment.hidden && (
                      <Chip
                        size="small"
                        color="warning"
                        label={portalCopy.board.hiddenChip}
                      />
                    )}
                    <Typography variant="caption" color="text.secondary">
                      {new Date(comment.created_at).toLocaleString("zh-CN")}
                    </Typography>
                    {comment.edited_at && (
                      <Tooltip
                        title={portalCopy.board.editedAt(
                          new Date(comment.edited_at).toLocaleString("zh-CN"),
                        )}
                      >
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ cursor: "help" }}
                        >
                          · {portalCopy.board.edited}
                        </Typography>
                      </Tooltip>
                    )}
                  </Stack>
                  {editing ? (
                    <Stack spacing={0.75} sx={{ mt: 0.5 }}>
                      <TextField
                        size="small"
                        fullWidth
                        multiline
                        maxRows={5}
                        autoFocus
                        value={editBody}
                        error={Boolean(editError)}
                        helperText={editError ?? `${editBody.length} / ${MAX_COMMENT}`}
                        onChange={(e) => setEditBody(e.target.value.slice(0, MAX_COMMENT))}
                        sx={{ bgcolor: "background.paper", borderRadius: 1 }}
                      />
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="contained"
                          color="secondary"
                          disabled={!editBody.trim() || editSaving}
                          onClick={() => void saveEdit()}
                        >
                          {portalCopy.board.commentSave}
                        </Button>
                        <Button
                          size="small"
                          disabled={editSaving}
                          onClick={() => setEditingId(null)}
                        >
                          {portalCopy.board.cancel}
                        </Button>
                      </Stack>
                    </Stack>
                  ) : (
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                      <LinkifiedText text={comment.body} />
                    </Typography>
                  )}
                </Box>
                {isOwn && canComment && !comment.hidden && !editing && (
                  <Tooltip title={portalCopy.board.actionEdit}>
                    <IconButton size="small" onClick={() => startEdit(comment)}>
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                {isAdmin && (
                  <Tooltip
                    title={
                      comment.hidden
                        ? portalCopy.board.actionUnhide
                        : portalCopy.board.actionHide
                    }
                  >
                    <IconButton
                      size="small"
                      onClick={() => onToggleHidden(comment.id, !comment.hidden)}
                    >
                      {/* Icon shows the current state: closed eye = hidden. */}
                      {comment.hidden ? (
                        <VisibilityOffIcon fontSize="small" />
                      ) : (
                        <VisibilityIcon fontSize="small" />
                      )}
                    </IconButton>
                  </Tooltip>
                )}
                {canDelete && (
                  <Tooltip title={portalCopy.board.actionDelete}>
                    <IconButton
                      size="small"
                      onClick={() => {
                        if (window.confirm(portalCopy.board.deleteConfirm)) {
                          onDelete(comment.id);
                        }
                      }}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
            );
          })}
        </Stack>
      )}

      {canComment && (
        <Stack spacing={0.5} sx={{ mt: 1.5 }}>
          <TextField
            size="small"
            fullWidth
            multiline
            maxRows={5}
            placeholder={portalCopy.board.commentPlaceholder}
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, MAX_COMMENT))}
            sx={{ bgcolor: "background.paper", borderRadius: 1 }}
          />
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            flexWrap="wrap"
            gap={1}
          >
            {mentorMustBeNamed ? (
              <Typography variant="caption" color="text.secondary">
                {portalCopy.board.mentorAnonymousBlocked}
              </Typography>
            ) : allowAnonymous ? (
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={anonymous}
                    onChange={(e) => setAnonymous(e.target.checked)}
                  />
                }
                label={
                  <Typography variant="caption">
                    {portalCopy.board.anonymousLabel}
                  </Typography>
                }
              />
            ) : (
              <span />
            )}
            <Button
              size="small"
              variant="contained"
              color="secondary"
              disabled={!body.trim() || pending}
              onClick={submit}
            >
              {portalCopy.board.commentSubmit}
            </Button>
          </Stack>
        </Stack>
      )}
    </Box>
  );
}
