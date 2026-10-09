"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import AnonymousAvatar from "@/components/portal/board/AnonymousAvatar";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import Collapse from "@mui/material/Collapse";
import Dialog from "@mui/material/Dialog";
import Skeleton from "@mui/material/Skeleton";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PushPinIcon from "@mui/icons-material/PushPin";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import type { BulletinComment, BulletinPost, BulletinReaction, Profile } from "@/types/portal";
import { categoryColors, categoryLabels, portalCopy, postColors } from "@/data/portalCopy";
import { getBulletinImageSignedUrl } from "@/lib/portal/uploads";
import ReactionBar from "./ReactionBar";
import { unreadChipSx } from "./unreadStyle";
import { AuthorAvatar, AuthorName } from "./AuthorIdentity";
import PostComments from "./PostComments";
import LinkifiedText from "./LinkifiedText";

/**
 * One post image, resolved to a signed URL at render time — the `bulletin`
 * bucket is not public, so `path` alone can't be dropped into an `<img src>`.
 * Cached per path (not per post) since the same image never needs re-signing
 * across cards.
 */
function PostImage({ path, onOpen }: { path: string; onOpen: (path: string) => void }) {
  const { data: url } = useQuery({
    queryKey: ["portal", "bulletinImageUrl", path],
    queryFn: () => getBulletinImageSignedUrl(path),
    staleTime: 55 * 60 * 1000, // just under the 1h signature lifetime
  });

  if (!url) {
    return <Skeleton variant="rounded" sx={{ width: "100%", aspectRatio: "1 / 1" }} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL, not optimizable by next/image
    <img
      src={url}
      alt=""
      onClick={() => onOpen(path)}
      style={{
        width: "100%",
        aspectRatio: "1 / 1",
        objectFit: "cover",
        borderRadius: 8,
        cursor: "pointer",
        display: "block",
      }}
    />
  );
}

function PostImageGrid({ imagePaths }: { imagePaths: string[] }) {
  const [openPath, setOpenPath] = React.useState<string | null>(null);
  const { data: openUrl } = useQuery({
    queryKey: ["portal", "bulletinImageUrl", openPath],
    queryFn: () => getBulletinImageSignedUrl(openPath!),
    enabled: openPath !== null,
    staleTime: 55 * 60 * 1000,
  });

  if (imagePaths.length === 0) return null;

  return (
    <>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: imagePaths.length === 1 ? "1fr" : "repeat(2, 1fr)",
          gap: 0.75,
          mt: 1.5,
          maxWidth: imagePaths.length === 1 ? 320 : "100%",
        }}
      >
        {imagePaths.map((path) => (
          <PostImage key={path} path={path} onOpen={setOpenPath} />
        ))}
      </Box>
      <Dialog open={openPath !== null} onClose={() => setOpenPath(null)} maxWidth="md">
        {openUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL, not optimizable by next/image
          <img src={openUrl} alt="" style={{ width: "100%", height: "auto", display: "block" }} />
        )}
      </Dialog>
    </>
  );
}

export type PostCardActions = {
  onToggleReaction: (postId: string, emoji: string, active: boolean) => void;
  onAddComment: (postId: string, body: string, isAnonymous: boolean) => void;
  onDeleteComment: (id: string) => void;
  /** Author-only; resolves once saved so the inline editor can close. */
  onEditComment: (id: string, body: string) => Promise<unknown>;
  onEditPost: (post: BulletinPost) => void;
  onToggleCommentHidden: (id: string, hidden: boolean) => void;
  onTogglePostHidden: (id: string, hidden: boolean) => void;
  onTogglePinned: (id: string, pinned: boolean) => void;
  onToggleResolved: (id: string, resolved: boolean) => void;
  onDeletePost: (id: string) => void;
  /** Opens the shared profile dialog for a non-anonymous author. */
  onOpenProfile: (profile: Profile) => void;
  /** Someone who follows the post opened its comments: clears its unread count. */
  onMarkSeen?: (postId: string) => void;
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
  isGrouped = false,
  mentorMustBeNamed = false,
  groupLabel,
  unreadCount = 0,
  highlight = false,
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
  /** Q&A board: show Mentor badges and the 「mentor 已回复」 chip. */
  isGrouped?: boolean;
  mentorMustBeNamed?: boolean;
  /** The post's group name, shown when cards from several groups are listed together. */
  groupLabel?: string;
  /** Comments by others on a post the viewer wrote or commented on, not yet opened. */
  unreadCount?: number;
  /** Arrived here from a reminder: outline the card and open its comments. */
  highlight?: boolean;
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
  const openComments = () => {
    setCommentsOpen(true);
    if (unreadCount > 0) actions.onMarkSeen?.(post.id);
  };
  const openedFromLink = React.useRef(false);
  React.useEffect(() => {
    if (!highlight || openedFromLink.current) return;
    openedFromLink.current = true;
    openComments();
    // openComments is recreated every render; this must fire once per arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlight]);
  const mentorReplied =
    isGrouped &&
    comments.some(
      (c) =>
        !c.is_anonymous &&
        !c.hidden &&
        c.author_id &&
        authorOf(c.author_id)?.participant_role === "mentor",
    );

  return (
    <Paper
      id={`post-${post.id}`}
      elevation={0}
      sx={{
        p: 2.5,
        mb: 2,
        borderRadius: 3,
        bgcolor: swatch.bg,
        border: highlight ? "2px solid" : "1px solid",
        borderColor: highlight ? "secondary.main" : post.hidden ? "warning.main" : swatch.border,
        borderStyle: post.hidden ? "dashed" : "solid",
        opacity: post.hidden ? 0.65 : 1,
        // Keeps a card from being split across masonry columns.
        breakInside: "avoid",
      }}
    >
      <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 1 }}>
        {/* An anonymous post never renders the author's avatar — admins and the
            author can resolve `author_id`, and passing it to `src` used to put
            the real face above 「匿名成员」. */}
        {post.is_anonymous ? (
          <AnonymousAvatar seed={post.id} size={32} />
        ) : (
          <AuthorAvatar author={author} size={32} onOpen={actions.onOpenProfile} />
        )}
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <AuthorName
            author={author}
            isAnonymous={post.is_anonymous}
            onOpen={actions.onOpenProfile}
          />
          <Typography variant="caption" color="text.secondary">
            {new Date(post.created_at).toLocaleString("zh-CN")}
          </Typography>
          {post.edited_at && (
            <Tooltip
              title={portalCopy.board.editedAt(
                new Date(post.edited_at).toLocaleString("zh-CN"),
              )}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ ml: 0.75, cursor: "help" }}
              >
                · {portalCopy.board.edited}
              </Typography>
            </Tooltip>
          )}
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
        {groupLabel && <Chip size="small" color="secondary" label={groupLabel} />}
        <Chip
          size="small"
          variant="outlined"
          label={categoryLabels[post.category]}
          color={categoryColors[post.category]}
        />
        {unreadCount > 0 && (
          <Chip
            size="small"
            sx={unreadChipSx}
            label={portalCopy.boardReplies.chip(unreadCount)}
            onClick={openComments}
          />
        )}
        {mentorReplied && (
          <Chip size="small" color="success" label={portalCopy.board.mentorReplied} />
        )}
        {post.pinned && (
          <Chip
            size="small"
            icon={<PushPinIcon />}
            label={portalCopy.board.pinned}
            sx={{
              bgcolor: "primary.main",
              color: "common.white",
              "& .MuiChip-icon": { color: "inherit" },
            }}
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
        <LinkifiedText text={post.body} />
      </Typography>

      <PostImageGrid imagePaths={post.image_paths} />

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
            onClick={() => (commentsOpen ? setCommentsOpen(false) : openComments())}
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
            showMentorBadge={isGrouped}
            mentorMustBeNamed={mentorMustBeNamed}
            pending={commentPending}
            onSubmit={(body, isAnonymous) =>
              actions.onAddComment(post.id, body, isAnonymous)
            }
            onDelete={actions.onDeleteComment}
            onEdit={actions.onEditComment}
            onToggleHidden={actions.onToggleCommentHidden}
            onOpenProfile={actions.onOpenProfile}
          />
        </Collapse>
      )}

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        {/* Author only — admins moderate but never reword. `canPost` already
            means an open board and season you belong to. */}
        {isOwnPost && canPost && !post.hidden && (
          <MenuItem
            onClick={() => {
              closeMenu();
              actions.onEditPost(post);
            }}
          >
            {portalCopy.board.actionEdit}
          </MenuItem>
        )}
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
