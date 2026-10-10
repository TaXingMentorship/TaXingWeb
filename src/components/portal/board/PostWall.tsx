"use client";

import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import type {
  BulletinBoard,
  BulletinComment,
  BulletinPost,
  BulletinReaction,
  Profile,
} from "@/types/portal";
import { portalCopy } from "@/data/portalCopy";
import PostCard, { type PostCardActions } from "./PostCard";

/**
 * Padlet-style wall. Masonry comes from CSS multi-column layout plus
 * `breakInside: avoid` on the cards — no extra dependency, and it collapses to
 * a single column on phones.
 */
export default function PostWall({
  posts,
  board,
  commentsByPost,
  reactionsByPost,
  authorOf,
  currentUserId,
  isAdmin,
  canPost,
  commentPending,
  actions,
  mentorMustBeNamed = false,
  groupNameOf,
  emptyText,
  maxColumns = 3,
  unreadByPost,
  highlightPostId,
}: {
  posts: BulletinPost[];
  board: BulletinBoard;
  commentsByPost: Map<string, BulletinComment[]>;
  reactionsByPost: Map<string, BulletinReaction[]>;
  authorOf: (id: string) => Profile | undefined;
  currentUserId: string | null;
  isAdmin: boolean;
  canPost: boolean;
  commentPending: boolean;
  actions: PostCardActions;
  mentorMustBeNamed?: boolean;
  /** Set when posts from several groups share the wall (「我的提问」). */
  groupNameOf?: (groupId: string | null) => string | undefined;
  emptyText?: string;
  /** Columns from `md` up; the Q&A layout gives up one to the group list. */
  maxColumns?: 2 | 3;
  unreadByPost?: Map<string, number>;
  highlightPostId?: string | null;
}) {
  if (posts.length === 0) {
    // Don't invite someone to post when they can't — archived season, closed
    // board, or a season they were not part of.
    const empty =
      emptyText ??
      (canPost
        ? (board.prompt ?? portalCopy.board.emptyWall)
        : portalCopy.board.emptyWallReadOnly);
    return <Alert severity="info">{empty}</Alert>;
  }

  return (
    <Box
      sx={{
        columnCount: { xs: 1, sm: 2, md: maxColumns },
        columnGap: 2,
      }}
    >
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          comments={commentsByPost.get(post.id) ?? []}
          reactions={reactionsByPost.get(post.id) ?? []}
          authorOf={authorOf}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          canPost={canPost}
          allowComments={board.allow_comments}
          allowAnonymous={board.allow_anonymous}
          isGrouped={board.use_groups}
          mentorMustBeNamed={mentorMustBeNamed}
          groupLabel={groupNameOf?.(post.group_id)}
          unreadCount={unreadByPost?.get(post.id) ?? 0}
          highlight={post.id === highlightPostId}
          commentPending={commentPending}
          actions={actions}
        />
      ))}
    </Box>
  );
}
