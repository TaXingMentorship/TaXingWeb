"use client";

import * as React from "react";
import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Avatar from "@mui/material/Avatar";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Collapse from "@mui/material/Collapse";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PushPinIcon from "@mui/icons-material/PushPin";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import type { BulletinComment, BulletinPost, BulletinReaction, Profile } from "@/types/portal";
import { categoryColors, categoryLabels, portalCopy, postColors } from "@/data/portalCopy";
import ReactionBar from "./ReactionBar";
import PostComments from "./PostComments";

export type PostCardActions = {
  onToggleReaction: (postId: string, emoji: string, active: boolean) => void;
  onAddComment: (postId: string, body: string, isAnonymous: boolean) => void;
  onDeleteComment: (id: string) => void;
  onToggleCommentHidden: (id: string, hidden: boolean) => void;
  onTogglePostHidden: (id: string, hidden: boolean) => void;
  onTogglePinned: (id: string, pinned: boolean) => void;
  onToggleResolved: (id: string, resolved: boolean) => void;
  onDeletePost: (id: string) => void;
};

export default function PostCard({
  post,
  comments,
  reactions,
  authorOf,
  currentUserId,
  isAdmin,
  canPost,
  allowComments,
  allowAnonymous,
  commentPending,
  actions,
}: {
  post: BulletinPost;
  comments: BulletinComment[];
  reactions: BulletinReaction[];
  authorOf: (id: string) => Profile | undefined;
  currentUserId: string | null;
  isAdmin: boolean;
  canPost: boolean;
  allowComments: boolean;
  allowAnonymous: boolean;
  commentPending: boolean;
  actions: PostCardActions;
}) {
  const [menuAnchor, setMenuAnchor] = React.useState<null | HTMLElement>(null);
  const [commentsOpen, setCommentsOpen] = React.useState(false);

  const swatch = postColors[post.color];
  // author_id is null for anonymous rows the viewer did not write (0009).
  const author = post.author_id ? authorOf(post.author_id) : undefined;
  const isOwnPost = post.author_id === currentUserId;
  const closeMenu = () => setMenuAnchor(null);

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        mb: 2,
        borderRadius: 3,
        bgcolor: swatch.bg,
        border: "1px solid",
        borderColor: post.hidden ? "warning.main" : swatch.border,
        borderStyle: post.hidden ? "dashed" : "solid",
        opacity: post.hidden ? 0.65 : 1,
        // Keeps a card from being split across masonry columns.
        breakInside: "avoid",
      }}
    >
      <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 1 }}>
        <Avatar
          src={author?.avatar_url ?? undefined}
          sx={{ width: 32, height: 32, fontSize: 14 }}
        >
          {post.is_anonymous ? "匿" : undefined}
        </Avatar>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={700} noWrap>
            {post.is_anonymous
              ? portalCopy.board.anonymousName
              : (author?.full_name ?? portalCopy.board.pastMemberName)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {new Date(post.created_at).toLocaleString("zh-CN")}
          </Typography>
        </Box>
        {(isAdmin || isOwnPost) && (
          <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)}>
            <MoreVertIcon fontSize="small" />
          </IconButton>
        )}
      </Stack>

      <Stack
        direction="row"
        spacing={0.5}
        flexWrap="wrap"
        useFlexGap
        sx={{ mb: post.title || post.body ? 1 : 0 }}
      >
        <Chip
          size="small"
          variant="outlined"
          label={categoryLabels[post.category]}
          color={categoryColors[post.category]}
        />
        {post.pinned && (
          <Chip
            size="small"
            color="secondary"
            icon={<PushPinIcon />}
            label={portalCopy.board.pinned}
          />
        )}
        {post.resolved && (
          <Chip
            size="small"
            color="success"
            icon={<CheckCircleIcon />}
            label={portalCopy.board.resolved}
          />
        )}
        {post.hidden && (
          <Chip size="small" color="warning" label={portalCopy.board.hiddenChip} />
        )}
      </Stack>

      {post.title && (
        <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
          {post.title}
        </Typography>
      )}
      <Typography sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {post.body}
      </Typography>

      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        gap={1}
        sx={{ mt: 1.5 }}
      >
        <ReactionBar
          reactions={reactions}
          currentUserId={currentUserId}
          disabled={!canPost}
          onToggle={(emoji, active) =>
            actions.onToggleReaction(post.id, emoji, active)
          }
        />
        {allowComments && (
          <Button
            size="small"
            startIcon={<ChatBubbleOutlineIcon />}
            onClick={() => setCommentsOpen((open) => !open)}
            sx={{ color: "text.secondary" }}
          >
            {comments.length} {portalCopy.board.commentsToggle}
          </Button>
        )}
      </Stack>

      {allowComments && (
        <Collapse in={commentsOpen} unmountOnExit>
          <PostComments
            comments={comments}
            authorOf={authorOf}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            canComment={canPost}
            allowAnonymous={allowAnonymous}
            pending={commentPending}
            onSubmit={(body, isAnonymous) =>
              actions.onAddComment(post.id, body, isAnonymous)
            }
            onDelete={actions.onDeleteComment}
            onToggleHidden={actions.onToggleCommentHidden}
          />
        </Collapse>
      )}

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        {isAdmin && (
          <MenuItem
            onClick={() => {
              actions.onTogglePinned(post.id, !post.pinned);
              closeMenu();
            }}
          >
            {post.pinned ? portalCopy.board.actionUnpin : portalCopy.board.actionPin}
          </MenuItem>
        )}
        {(isAdmin || isOwnPost) && (
          <MenuItem
            onClick={() => {
              actions.onToggleResolved(post.id, !post.resolved);
              closeMenu();
            }}
          >
            {post.resolved
              ? portalCopy.board.actionUnresolve
              : portalCopy.board.actionResolve}
          </MenuItem>
        )}
        {isAdmin && (
          <MenuItem
            onClick={() => {
              actions.onTogglePostHidden(post.id, !post.hidden);
              closeMenu();
            }}
          >
            {post.hidden ? portalCopy.board.actionUnhide : portalCopy.board.actionHide}
          </MenuItem>
        )}
        {(isAdmin || isOwnPost) && (
          <MenuItem
            onClick={() => {
              closeMenu();
              if (window.confirm(portalCopy.board.deleteConfirm)) {
                actions.onDeletePost(post.id);
              }
            }}
          >
            {portalCopy.board.actionDelete}
          </MenuItem>
        )}
      </Menu>
    </Paper>
  );
}
