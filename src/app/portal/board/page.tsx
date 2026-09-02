"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Chip from "@mui/material/Chip";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import AddIcon from "@mui/icons-material/Add";
import type {
  Cohort,
  BulletinCategory,
  BulletinComment,
  BulletinPost,
  BulletinReaction,
  Profile,
} from "@/types/portal";
import {
  countPostsByBoard,
  createComment,
  createPost,
  deleteComment,
  deletePost,
  listBoards,
  listCohorts,
  listComments,
  listPosts,
  listProfiles,
  listReactions,
  setBoardOpen,
  setCommentHidden,
  setPostHidden,
  setPostPinned,
  setPostResolved,
  toggleReaction,
} from "@/lib/portal/store";
import { categoryLabels, portalCopy } from "@/data/portalCopy";
import { usePortalSession } from "@/components/portal/PortalSessionProvider";
import BoardTabs, {
  CreateBoardDialog,
} from "@/components/portal/board/BoardTabs";
import SeasonTabs from "@/components/portal/board/SeasonTabs";
import PostWall from "@/components/portal/board/PostWall";
import PostComposer, {
  type ComposerDraft,
} from "@/components/portal/board/PostComposer";
import type { PostCardActions } from "@/components/portal/board/PostCard";

type SortMode = "newest" | "reactions";

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const bucket = map.get(key(item));
    if (bucket) bucket.push(item);
    else map.set(key(item), [item]);
  }
  return map;
}

/**
 * `useSearchParams` needs a Suspense boundary during prerender, so the page
 * body lives in a child component.
 */
export default function BoardPage() {
  return (
    <React.Suspense
      fallback={
        <Typography color="text.secondary">{portalCopy.board.loading}</Typography>
      }
    >
      <BoardPageContent />
    </React.Suspense>
  );
}

function BoardPageContent() {
  const { currentUser } = usePortalSession();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const isAdmin = currentUser?.is_admin ?? false;
  const canPost = isAdmin || Boolean(currentUser?.participant_role);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [composeOpen, setComposeOpen] = React.useState(false);
  const [filter, setFilter] = React.useState<BulletinCategory | "all">("all");
  const [sort, setSort] = React.useState<SortMode>("newest");

  // RLS scopes this already: members get their own cohorts, admins get all.
  const { data: cohorts } = useQuery({
    queryKey: ["portal", "cohorts"],
    queryFn: listCohorts,
    enabled: Boolean(currentUser),
  });

  // Newest season first, so this lands on the current one by default.
  const requestedCohortId = searchParams.get("cohort");
  const selectedCohort = React.useMemo(() => {
    if (!cohorts || cohorts.length === 0) return null;
    return cohorts.find((c: Cohort) => c.id === requestedCohortId) ?? cohorts[0];
  }, [cohorts, requestedCohortId]);
  const cohortId = selectedCohort?.id ?? null;

  const { data: boards, isLoading: boardsLoading } = useQuery({
    queryKey: ["portal", "boards", cohortId],
    queryFn: () => listBoards({ cohortIds: [cohortId!] }),
    enabled: Boolean(cohortId),
  });

  const { data: counts } = useQuery({
    queryKey: ["portal", "boardCounts", isAdmin],
    queryFn: () => countPostsByBoard(isAdmin),
  });

  // The selected board lives in the URL so a tab can be linked and shared.
  const requestedBoardId = searchParams.get("board");
  const selectedBoard = React.useMemo(() => {
    if (!boards || boards.length === 0) return null;
    return boards.find((b) => b.id === requestedBoardId) ?? boards[0];
  }, [boards, requestedBoardId]);
  const boardId = selectedBoard?.id ?? null;

  const selectBoard = (id: string) => {
    setFilter("all");
    router.replace(`/portal/board?cohort=${cohortId}&board=${id}`, {
      scroll: false,
    });
  };

  /** Switching season drops the board param so it falls to that season's first. */
  const selectCohort = (id: string) => {
    setFilter("all");
    setSort("newest");
    router.replace(`/portal/board?cohort=${id}`, { scroll: false });
  };

  const { data: posts } = useQuery({
    queryKey: ["portal", "posts", boardId, isAdmin],
    queryFn: () => listPosts({ boardId: boardId!, includeHidden: isAdmin }),
    enabled: Boolean(boardId),
  });

  const { data: profiles } = useQuery({
    queryKey: ["portal", "profiles"],
    queryFn: () => listProfiles(),
  });

  const postIds = React.useMemo(() => (posts ?? []).map((p) => p.id), [posts]);

  const { data: comments } = useQuery({
    queryKey: ["portal", "comments", boardId, isAdmin, postIds.length],
    queryFn: () => listComments({ postIds, includeHidden: isAdmin }),
    enabled: postIds.length > 0,
  });

  const { data: reactions } = useQuery({
    queryKey: ["portal", "reactions", boardId, postIds.length],
    queryFn: () => listReactions({ postIds }),
    enabled: postIds.length > 0,
  });

  const commentsByPost = React.useMemo(
    () => groupBy(comments ?? [], (c: BulletinComment) => c.post_id),
    [comments],
  );
  const reactionsByPost = React.useMemo(
    () => groupBy(reactions ?? [], (r: BulletinReaction) => r.post_id),
    [reactions],
  );

  const authorOf = React.useCallback(
    (id: string): Profile | undefined => profiles?.find((p) => p.id === id),
    [profiles],
  );

  const invalidateComments = () =>
    queryClient.invalidateQueries({ queryKey: ["portal", "comments"] });
  const invalidateReactions = () =>
    queryClient.invalidateQueries({ queryKey: ["portal", "reactions"] });
  const invalidatePosts = () => {
    queryClient.invalidateQueries({ queryKey: ["portal", "posts"] });
    queryClient.invalidateQueries({ queryKey: ["portal", "boardCounts"] });
    // Deleting a post cascades to its comments and reactions, and the
    // comment/reaction query keys are derived from the post list.
    invalidateComments();
    invalidateReactions();
  };

  const createPostMutation = useMutation({
    mutationFn: (draft: ComposerDraft) =>
      createPost({
        cohort_id: selectedBoard!.cohort_id,
        board_id: selectedBoard!.id,
        author_id: currentUser!.id,
        category: draft.category,
        title: draft.title,
        body: draft.body,
        is_anonymous: draft.isAnonymous,
        color: draft.color,
      }),
    onSuccess: () => {
      setComposeOpen(false);
      invalidatePosts();
    },
  });

  const commentMutation = useMutation({
    mutationFn: (input: {
      postId: string;
      body: string;
      isAnonymous: boolean;
    }) =>
      createComment({
        post_id: input.postId,
        cohort_id: selectedBoard!.cohort_id,
        author_id: currentUser!.id,
        body: input.body,
        is_anonymous: input.isAnonymous,
      }),
    onSuccess: invalidateComments,
  });

  const reactionMutation = useMutation({
    mutationFn: (input: { postId: string; emoji: string; active: boolean }) =>
      toggleReaction({
        post_id: input.postId,
        cohort_id: selectedBoard!.cohort_id,
        user_id: currentUser!.id,
        emoji: input.emoji,
        active: input.active,
      }),
    onSuccess: invalidateReactions,
  });

  const postFlagMutation = useMutation({
    mutationFn: (input: {
      id: string;
      field: "hidden" | "pinned" | "resolved";
      value: boolean;
    }) => {
      if (input.field === "hidden") return setPostHidden(input.id, input.value);
      if (input.field === "pinned") return setPostPinned(input.id, input.value);
      return setPostResolved(input.id, input.value);
    },
    onSuccess: invalidatePosts,
  });

  const deletePostMutation = useMutation({
    mutationFn: (id: string) => deletePost(id),
    onSuccess: invalidatePosts,
  });

  const commentFlagMutation = useMutation({
    mutationFn: (input: { id: string; hidden: boolean }) =>
      setCommentHidden(input.id, input.hidden),
    onSuccess: invalidateComments,
  });

  const boardToggleMutation = useMutation({
    mutationFn: (input: { id: string; open: boolean }) =>
      setBoardOpen(input.id, input.open),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["portal", "boards"] }),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (id: string) => deleteComment(id),
    onSuccess: invalidateComments,
  });

  const actions: PostCardActions = {
    onToggleReaction: (postId, emoji, active) =>
      reactionMutation.mutate({ postId, emoji, active }),
    onAddComment: (postId, body, isAnonymous) =>
      commentMutation.mutate({ postId, body, isAnonymous }),
    onDeleteComment: (id) => deleteCommentMutation.mutate(id),
    onToggleCommentHidden: (id, hidden) =>
      commentFlagMutation.mutate({ id, hidden }),
    onTogglePostHidden: (id, hidden) =>
      postFlagMutation.mutate({ id, field: "hidden", value: hidden }),
    onTogglePinned: (id, pinned) =>
      postFlagMutation.mutate({ id, field: "pinned", value: pinned }),
    onToggleResolved: (id, resolved) =>
      postFlagMutation.mutate({ id, field: "resolved", value: resolved }),
    onDeletePost: (id) => deletePostMutation.mutate(id),
  };

  const visiblePosts = React.useMemo(() => {
    const filtered = (posts ?? []).filter((p: BulletinPost) =>
      filter === "all" ? true : p.category === filter,
    );
    if (sort === "newest") return filtered;
    // Pinned posts stay on top regardless of the sort mode.
    return [...filtered].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const countOf = (id: string) => reactionsByPost.get(id)?.length ?? 0;
      return countOf(b.id) - countOf(a.id);
    });
  }, [posts, filter, sort, reactionsByPost]);

  const filterCategories = selectedBoard?.allowed_categories?.length
    ? selectedBoard.allowed_categories
    : Array.from(new Set((posts ?? []).map((p: BulletinPost) => p.category)));

  // A closed season overrides every board's own is_open flag.
  const seasonOpen = selectedCohort?.bulletin_open ?? true;
  const boardOpen = Boolean(selectedBoard?.is_open) && seasonOpen;

  // Reading is open across every season (migration 0008); posting, commenting
  // and reacting stay limited to seasons you took part in — the insert
  // policies enforce it, this keeps the UI honest about it.
  const isMember = Boolean(
    cohortId && currentUser?.cohort_ids.includes(cohortId),
  );
  const canParticipate = canPost && (isAdmin || isMember);

  const mutationError = [
    createPostMutation.error,
    commentMutation.error,
    reactionMutation.error,
    postFlagMutation.error,
    deletePostMutation.error,
    commentFlagMutation.error,
    deleteCommentMutation.error,
    boardToggleMutation.error,
  ].find(Boolean) as Error | undefined;

  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        gap={1}
        sx={{ mb: 1 }}
      >
        <Typography variant="h4" fontWeight={800}>
          {portalCopy.board.title}
        </Typography>
        {isAdmin && (
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<AddIcon />}
            onClick={() => setCreateOpen(true)}
          >
            {portalCopy.board.createButton}
          </Button>
        )}
      </Stack>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {portalCopy.board.listSubtitle}
      </Typography>

      {/* Outside the boards branch: a season with no boards yet must still be
          switchable, otherwise the user is stranded in it. Rendered even for a
          single season — it names the season you are looking at. */}
      {cohorts && cohorts.length > 0 && (
        <SeasonTabs
          cohorts={cohorts}
          selectedId={cohortId}
          onSelect={selectCohort}
        />
      )}

      {boardsLoading ? (
        <Typography color="text.secondary">{portalCopy.board.loading}</Typography>
      ) : !boards || boards.length === 0 ? (
        <Alert severity="info">{portalCopy.board.empty}</Alert>
      ) : (
        <>
          <BoardTabs
            boards={boards}
            counts={counts ?? {}}
            selectedId={boardId}
            onSelect={selectBoard}
          />

          {selectedBoard && (
            <>
              {isAdmin && (
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={selectedBoard.is_open}
                      onChange={(event) =>
                        boardToggleMutation.mutate({
                          id: selectedBoard.id,
                          open: event.target.checked,
                        })
                      }
                    />
                  }
                  label={portalCopy.board.openLabel}
                  sx={{ mb: 1 }}
                />
              )}
              {selectedBoard.description && (
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                  {selectedBoard.description}
                </Typography>
              )}

              {mutationError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {mutationError.message}
                </Alert>
              )}

              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                flexWrap="wrap"
                gap={1.5}
                sx={{ mb: 2 }}
              >
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip
                    label="全部"
                    color={filter === "all" ? "secondary" : "default"}
                    onClick={() => setFilter("all")}
                  />
                  {filterCategories.map((c) => (
                    <Chip
                      key={c}
                      label={categoryLabels[c]}
                      color={filter === c ? "secondary" : "default"}
                      onClick={() => setFilter(c)}
                    />
                  ))}
                </Stack>

                <Stack direction="row" spacing={1.5} alignItems="center">
                  <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={sort}
                    onChange={(_, value: SortMode | null) =>
                      value && setSort(value)
                    }
                  >
                    <ToggleButton value="newest">
                      {portalCopy.board.sortNewest}
                    </ToggleButton>
                    <ToggleButton value="reactions">
                      {portalCopy.board.sortReactions}
                    </ToggleButton>
                  </ToggleButtonGroup>

                  {boardOpen && canParticipate && (
                    <Button
                      variant="contained"
                      color="secondary"
                      startIcon={<AddIcon />}
                      onClick={() => setComposeOpen(true)}
                    >
                      {portalCopy.board.composeButton}
                    </Button>
                  )}
                </Stack>
              </Stack>

              {!seasonOpen ? (
                <Alert severity="info" sx={{ mb: 2 }}>
                  {portalCopy.board.seasonArchived}
                </Alert>
              ) : !isMember && !isAdmin ? (
                <Alert severity="info" sx={{ mb: 2 }}>
                  {portalCopy.board.otherSeasonReadOnly}
                </Alert>
              ) : !selectedBoard.is_open ? (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  {portalCopy.board.boardClosed}
                </Alert>
              ) : (
                !canPost && (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    {portalCopy.board.volunteerReadOnly}
                  </Alert>
                )
              )}

              <PostWall
                posts={visiblePosts}
                board={selectedBoard}
                commentsByPost={commentsByPost}
                reactionsByPost={reactionsByPost}
                authorOf={authorOf}
                currentUserId={currentUser?.id ?? null}
                isAdmin={isAdmin}
                canPost={canParticipate && boardOpen}
                commentPending={commentMutation.isPending}
                actions={actions}
              />

              <PostComposer
                open={composeOpen}
                board={selectedBoard}
                pending={createPostMutation.isPending}
                error={
                  createPostMutation.error
                    ? (createPostMutation.error as Error).message
                    : null
                }
                onClose={() => setComposeOpen(false)}
                onSubmit={(draft) => createPostMutation.mutate(draft)}
              />
            </>
          )}
        </>
      )}

      {isAdmin && (
        <CreateBoardDialog
          open={createOpen}
          cohortId={cohortId ?? ""}
          onClose={() => setCreateOpen(false)}
          onCreated={(board) => {
            setCreateOpen(false);
            queryClient.invalidateQueries({ queryKey: ["portal", "boards"] });
            selectBoard(board.id);
          }}
        />
      )}
    </Box>
  );
}
