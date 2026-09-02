"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Avatar from "@mui/material/Avatar";
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
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import type { BulletinComment, Profile } from "@/types/portal";
import { portalCopy } from "@/data/portalCopy";

const MAX_COMMENT = 2000;

export default function PostComments({
  comments,
  authorOf,
  currentUserId,
  isAdmin,
  canComment,
  allowAnonymous,
  pending,
  onSubmit,
  onDelete,
  onToggleHidden,
}: {
  comments: BulletinComment[];
  authorOf: (id: string) => Profile | undefined;
  currentUserId: string | null;
  isAdmin: boolean;
  canComment: boolean;
  allowAnonymous: boolean;
  pending: boolean;
  onSubmit: (body: string, isAnonymous: boolean) => void;
  onDelete: (id: string) => void;
  onToggleHidden: (id: string, hidden: boolean) => void;
}) {
  const [body, setBody] = React.useState("");
  const [anonymous, setAnonymous] = React.useState(false);

  const submit = () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    onSubmit(trimmed, allowAnonymous && anonymous);
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
            const canDelete = isAdmin || comment.author_id === currentUserId;
            return (
              <Stack
                key={comment.id}
                direction="row"
                spacing={1}
                alignItems="flex-start"
                sx={{ opacity: comment.hidden ? 0.6 : 1 }}
              >
                <Avatar
                  src={author?.avatar_url ?? undefined}
                  sx={{ width: 26, height: 26, fontSize: 13 }}
                >
                  {comment.is_anonymous ? "匿" : undefined}
                </Avatar>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Stack
                    direction="row"
                    spacing={0.75}
                    alignItems="center"
                    flexWrap="wrap"
                    useFlexGap
                  >
                    <Typography variant="body2" fontWeight={700}>
                      {comment.is_anonymous
                        ? portalCopy.board.anonymousName
                        : (author?.full_name ?? portalCopy.board.pastMemberName)}
                    </Typography>
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
                  </Stack>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                    {comment.body}
                  </Typography>
                </Box>
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
            {allowAnonymous ? (
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
