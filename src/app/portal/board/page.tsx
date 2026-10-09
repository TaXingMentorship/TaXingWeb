"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Chip from "@mui/material/Chip";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";
import { createTheme, ThemeProvider, useTheme } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import type {
  Cohort,
  BulletinBoard,
  BulletinCategory,
  BulletinComment,
  BulletinPost,
  BulletinReaction,
  Profile,
} from "@/types/portal";
import type { SearchHit } from "@/components/portal/board/QaSearchResults";
import {
  countPostsByBoard,
  deleteBoard,
  createComment,
  createPost,
  deleteComment,
  deletePost,
  editComment,
  editPost,
  listBoardNotices,
  markPostSeen,
  listBoards,
  listCohorts,
  listMentorGroupMembers,
  listMentorGroups,
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
import { uploadBulletinImage } from "@/lib/portal/uploads";
import { usePortalSession } from "@/components/portal/PortalSessionProvider";
import BoardTabs, { BoardDialog } from "@/components/portal/board/BoardTabs";
import SeasonTabs from "@/components/portal/board/SeasonTabs";
import PostWall from "@/components/portal/board/PostWall";
import LinkifiedText from "@/components/portal/board/LinkifiedText";
import ProfileDialog from "@/components/portal/ProfileDialog";
import PostComposer, {
  type ComposerDraft,
} from "@/components/portal/board/PostComposer";
import type { PostCardActions } from "@/components/portal/board/PostCard";
import GroupSidebar, { MINE } from "@/components/portal/board/GroupSidebar";
import MentorStrip from "@/components/portal/board/MentorStrip";
import BoardNotices from "@/components/portal/board/BoardNotices";
import { UNREAD_COMMENTS_KEY, useUnreadComments } from "@/components/portal/useUnreadComments";
import UnreadBar from "@/components/portal/board/UnreadBar";
import QaSearchResults from "@/components/portal/board/QaSearchResults";

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
  const baseTheme = useTheme();
  const boardTheme = React.useMemo(
    () =>
      createTheme(baseTheme, {
        palette: {
          secondary: {
            main: "#FEBD59",
            contrastText: "#fff",
          },
        },
        components: {
          MuiButton: {
            styleOverrides: {
              root: {
                "&:not(.MuiButton-colorError)": {
                  backgroundColor: "#FEBD59",
                  borderColor: "#FEBD59",
                  color: "#fff",
                  "&:hover": {
                    backgroundColor: "#F5AC3D",
                    borderColor: "#F5AC3D",
                  },
                  "&.Mui-disabled": {
                    backgroundColor: "rgba(254, 189, 89, 0.45)",
                    borderColor: "transparent",
                    color: "rgba(255, 255, 255, 0.75)",
                  },
                },
              },
            },
          },
          MuiToggleButton: {
            styleOverrides: {
              root: {
                "&.Mui-selected": {
                  backgroundColor: "#FEBD59",
                  color: "#fff",
                  "&:hover": { backgroundColor: "#F5AC3D" },
                },
              },
            },
          },
        },
      }),
    [baseTheme],
  );

  return (
    <ThemeProvider theme={boardTheme}>
      <React.Suspense
        fallback={
          <Typography color="text.secondary">{portalCopy.board.loading}</Typography>
        }
      >
        <BoardPageContent />
      </React.Suspense>
    </ThemeProvider>
  );
}

function BoardPageContent() {
  const { currentUser } = usePortalSession();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const isAdmin = currentUser?.is_admin ?? false;
  // Mirrors the insert policies (migration 0015): admins, participants and
  // volunteers may write; a non-member of the season is filtered out below.
  const canPost =
    isAdmin ||
    Boolean(currentUser?.participant_role) ||
    Boolean(currentUser?.is_volunteer);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editingBoard, setEditingBoard] = React.useState<BulletinBoard | null>(
    null,
  );
  const [pendingDelete, setPendingDelete] =
    React.useState<BulletinBoard | null>(null);
  const [composeOpen, setComposeOpen] = React.useState(false);
  const [editingPost, setEditingPost] = React.useState<BulletinPost | null>(null);
  const [openProfile, setOpenProfile] = React.useState<Profile | null>(null);
  const [filter, setFilter] = React.useState<BulletinCategory | "all">("all");
  const [sort, setSort] = React.useState<SortMode>("newest");

  // RLS scopes this already: members get their own cohorts, admins get all.
  const { data: cohorts } = useQuery({
    queryKey: ["portal", "cohorts"],
    queryFn: listCohorts,
    enabled: Boolean(currentUser),
  });

  /**
   * Every board the viewer may see, fetched once rather than per season — the
   * season row needs to know which seasons have boards at all, and one request
   * answers both that and "which boards are in the selected season".
   */
  const { data: allBoards, isLoading: boardsLoading } = useQuery({
    queryKey: ["portal", "boards", "all"],
    queryFn: () => listBoards(),
    enabled: Boolean(currentUser),
  });

  /**
   * Seasons that actually have a board. Since the volunteer backfill added the
   * historical seasons, `cohorts` holds eleven entries of which only two have
   * ever had a board — listing the other nine gave admins a row of tabs that
   * all led to the same empty state.
   *
   * Creating the *first* board of a season still works: BoardDialog
   * carries its own season picker over the full list.
   */
  const seasonsWithBoards = React.useMemo(() => {
    if (!cohorts) return [];
    const withBoards = new Set((allBoards ?? []).map((board) => board.cohort_id));
    return cohorts.filter((cohort: Cohort) => withBoards.has(cohort.id));
  }, [cohorts, allBoards]);

  // Newest season first, so this lands on the current one by default.
  const requestedCohortId = searchParams.get("cohort");
  const selectedCohort = React.useMemo(() => {
    if (seasonsWithBoards.length === 0) return null;
    return (
      seasonsWithBoards.find((c: Cohort) => c.id === requestedCohortId) ??
      seasonsWithBoards[0]
    );
  }, [seasonsWithBoards, requestedCohortId]);
  const cohortId = selectedCohort?.id ?? null;

  const boards = React.useMemo(
    () => (allBoards ?? []).filter((board) => board.cohort_id === cohortId),
    [allBoards, cohortId],
  );

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

  const { data: profiles } = useQuery({
    queryKey: ["portal", "profiles"],
    queryFn: () => listProfiles(),
  });

  const isQa = Boolean(selectedBoard?.use_groups);

  // --- Mentor Q&A groups (boards with use_groups) ---------------------------
  const { data: groups } = useQuery({
    queryKey: ["portal", "mentorGroups", cohortId],
    queryFn: () => listMentorGroups({ cohortId: cohortId! }),
    enabled: Boolean(cohortId) && isQa,
  });
  const { data: groupMembers } = useQuery({
    queryKey: ["portal", "mentorGroupMembers", cohortId],
    queryFn: () => listMentorGroupMembers({ cohortId: cohortId! }),
    enabled: Boolean(cohortId) && isQa,
  });
  const { data: notices } = useQuery({
    queryKey: ["portal", "boardNotices", boardId],
    queryFn: () => listBoardNotices(boardId!),
    enabled: Boolean(boardId) && isQa,
  });
  const { posts: unreadPosts, byPost: unreadByPost } = useUnreadComments();
  const unreadByGroup = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const post of unreadPosts) {
      if (post.board_id === boardId && post.group_id) {
        counts[post.group_id] = (counts[post.group_id] ?? 0) + post.unread_count;
      }
    }
    return counts;
  }, [unreadPosts, boardId]);
  // Arriving from a reminder: ?post= outlines that card, opens its comments and
  // scrolls it into view once the wall has rendered.
  const focusPostId = searchParams.get("post");
  const scrolledTo = React.useRef<string | null>(null);
  const [search, setSearch] = React.useState("");
  const query = search.trim();

  const groupList = React.useMemo(() => groups ?? [], [groups]);
  const myGroupId = groupMembers?.find((m) => m.profile_id === currentUser?.id)?.group_id;
  // The group lives in the URL like the board does, so it can be linked.
  const requestedGroup = searchParams.get("group");
  const groupSel =
    requestedGroup === MINE || groupList.some((g) => g.id === requestedGroup)
      ? (requestedGroup as string)
      : groupList.some((g) => g.id === myGroupId)
        ? (myGroupId as string)
        : (groupList[0]?.id ?? MINE);
  const activeGroup = groupList.find((g) => g.id === groupSel) ?? null;

  const openUnread = (item: { cohort_id: string; board_id: string; group_id: string | null; post_id: string }) => {
    setFilter("all");
    setSearch("");
    router.replace(
      `/portal/board?cohort=${item.cohort_id}&board=${item.board_id}` +
        (item.group_id ? `&group=${item.group_id}` : "") +
        `&post=${item.post_id}`,
      { scroll: false },
    );
  };

  const selectGroup = (value: string) => {
    setFilter("all");
    setSearch("");
    router.replace(
      `/portal/board?cohort=${cohortId}&board=${boardId}&group=${value}`,
      { scroll: false },
    );
  };

  const mentorsOfGroup = React.useCallback(
    (groupId: string): Profile[] => {
      const ids = new Set(
        (groupMembers ?? []).filter((m) => m.group_id === groupId).map((m) => m.profile_id),
      );
      return (profiles ?? [])
        .filter((p) => ids.has(p.id))
        .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? "", "zh-CN"));
    },
    [groupMembers, profiles],
  );
  const groupNameOf = React.useCallback(
    (id: string | null) => groupList.find((g) => g.id === id)?.name,
    [groupList],
  );

  const selectBoard = (id: string) => {
    setFilter("all");
    setSearch("");
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

  // 「我的提问」 only lists posts the viewer wrote, so its badge counts just those;
  // threads they merely commented on show up on their group instead.
  const myPostIds = new Set(
    (posts ?? []).filter((p) => p.author_id !== null && p.author_id === currentUser?.id).map((p) => p.id),
  );
  const mineUnread = unreadPosts
    .filter((post) => post.board_id === boardId && myPostIds.has(post.post_id))
    .reduce((sum, post) => sum + post.unread_count, 0);
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
    mutationFn: async (draft: ComposerDraft) => {
      // Every image must land before the post does — a post referencing an
      // image that never made it up would show a broken thumbnail forever.
      const image_paths = await Promise.all(
        draft.imageFiles.map((file) => uploadBulletinImage(currentUser!.id, file)),
      );
      return createPost({
        cohort_id: selectedBoard!.cohort_id,
        board_id: selectedBoard!.id,
        author_id: currentUser!.id,
        category: draft.category,
        title: draft.title,
        body: draft.body,
        is_anonymous: draft.isAnonymous,
        color: draft.color,
        image_paths,
        group_id: draft.groupId,
      });
    },
    onSuccess: () => {
      setComposeOpen(false);
      invalidatePosts();
    },
  });

  const editPostMutation = useMutation({
    mutationFn: (input: { id: string; draft: ComposerDraft }) =>
      editPost(input.id, {
        title: input.draft.title,
        body: input.draft.body,
        category: input.draft.category,
        color: input.draft.color,
      }),
    onSuccess: () => {
      setEditingPost(null);
      queryClient.invalidateQueries({ queryKey: ["portal", "posts"] });
    },
  });

  const editCommentMutation = useMutation({
    mutationFn: (input: { id: string; body: string }) =>
      editComment(input.id, input.body),
    onSuccess: invalidateComments,
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
    onSuccess: () => {
      invalidateComments();
      // Writing a reply counts as having read the thread up to now.
      queryClient.invalidateQueries({ queryKey: UNREAD_COMMENTS_KEY });
    },
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

  const deleteBoardMutation = useMutation({
    mutationFn: (id: string) => deleteBoard(id),
    onSuccess: () => {
      setPendingDelete(null);
      queryClient.invalidateQueries({ queryKey: ["portal", "boards"] });
      queryClient.invalidateQueries({ queryKey: ["portal", "boardCounts"] });
      // Drop the board param so the page falls to the season's first board;
      // if that was the last one, seasonsWithBoards shrinks on its own.
      router.replace(`/portal/board?cohort=${cohortId}`, { scroll: false });
    },
  });

  const markSeenMutation = useMutation({
    mutationFn: (postId: string) => markPostSeen(currentUser!.id, postId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: UNREAD_COMMENTS_KEY }),
  });

  const actions: PostCardActions = {
    onMarkSeen: (postId) => markSeenMutation.mutate(postId),
    onToggleReaction: (postId, emoji, active) =>
      reactionMutation.mutate({ postId, emoji, active }),
    onAddComment: (postId, body, isAnonymous) =>
      commentMutation.mutate({ postId, body, isAnonymous }),
    onDeleteComment: (id) => deleteCommentMutation.mutate(id),
    onEditComment: (id, body) => editCommentMutation.mutateAsync({ id, body }),
    onEditPost: (post) => {
      editPostMutation.reset();
      setEditingPost(post);
    },
    onToggleCommentHidden: (id, hidden) =>
      commentFlagMutation.mutate({ id, hidden }),
    onTogglePostHidden: (id, hidden) =>
      postFlagMutation.mutate({ id, field: "hidden", value: hidden }),
    onTogglePinned: (id, pinned) =>
      postFlagMutation.mutate({ id, field: "pinned", value: pinned }),
    onToggleResolved: (id, resolved) =>
      postFlagMutation.mutate({ id, field: "resolved", value: resolved }),
    onDeletePost: (id) => deletePostMutation.mutate(id),
    onOpenProfile: setOpenProfile,
  };

  const visiblePosts = React.useMemo(() => {
    const filtered = (posts ?? []).filter((p: BulletinPost) => {
      if (filter !== "all" && p.category !== filter) return false;
      if (!isQa) return true;
      // author_id is the viewer's own even on an anonymous post (0009).
      if (groupSel === MINE) return p.author_id !== null && p.author_id === currentUser?.id;
      return p.group_id === groupSel;
    });
    // Posts with comments the viewer has not opened come first, so a reminder
    // is never buried under newer posts; pinned posts still lead.
    const unreadFirst = (a: BulletinPost, b: BulletinPost) =>
      Number(unreadByPost.has(b.id)) - Number(unreadByPost.has(a.id));
    if (sort === "newest") {
      return [...filtered].sort((a, b) =>
        a.pinned !== b.pinned ? (a.pinned ? -1 : 1) : unreadFirst(a, b),
      );
    }
    // Pinned posts stay on top regardless of the sort mode.
    return [...filtered].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const countOf = (id: string) => reactionsByPost.get(id)?.length ?? 0;
      return countOf(b.id) - countOf(a.id);
    });
  }, [posts, filter, sort, reactionsByPost, isQa, groupSel, currentUser?.id, unreadByPost]);

  const postCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of posts ?? []) if (p.group_id) counts[p.group_id] = (counts[p.group_id] ?? 0) + 1;
    return counts;
  }, [posts]);
  const mineCount = (posts ?? []).filter(
    (p) => p.author_id !== null && p.author_id === currentUser?.id,
  ).length;

  // Board-wide search over titles, bodies and comments of every group.
  const searchHits = React.useMemo<SearchHit[]>(() => {
    if (!isQa || !query) return [];
    const q = query.toLowerCase();
    const hits: SearchHit[] = [];
    for (const post of posts ?? []) {
      const postComments = commentsByPost.get(post.id) ?? [];
      const commentHit = postComments.find((c) => c.body.toLowerCase().includes(q));
      const inPost =
        (post.title ?? "").toLowerCase().includes(q) || post.body.toLowerCase().includes(q);
      if (!inPost && !commentHit) continue;
      hits.push({
        postId: post.id,
        groupId: post.group_id,
        title: post.title,
        snippet: inPost ? post.body : (commentHit?.body ?? ""),
        mentorReplied: postComments.some(
          (c) =>
            !c.is_anonymous &&
            c.author_id &&
            authorOf(c.author_id)?.participant_role === "mentor",
        ),
      });
    }
    return hits;
  }, [isQa, query, posts, commentsByPost, authorOf]);

  const mentorMatches = React.useMemo(() => {
    if (!isQa || !query) return [];
    const q = query.toLowerCase();
    const seat = new Map((groupMembers ?? []).map((m) => [m.profile_id, m.group_id]));
    return (profiles ?? [])
      .filter((p) => seat.has(p.id) && (p.full_name ?? "").toLowerCase().includes(q))
      .map((profile) => ({ profile, groupId: seat.get(profile.id) ?? null }));
  }, [isQa, query, profiles, groupMembers]);

  React.useEffect(() => {
    if (!focusPostId || scrolledTo.current === focusPostId) return;
    if (!visiblePosts.some((p) => p.id === focusPostId)) return;
    scrolledTo.current = focusPostId;
    const timer = window.setTimeout(() => {
      document
        .getElementById(`post-${focusPostId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [focusPostId, visiblePosts]);

  const filterCategories = selectedBoard?.allowed_categories?.length
    ? selectedBoard.allowed_categories
    : Array.from(new Set((posts ?? []).map((p: BulletinPost) => p.category)));

  // A closed season overrides every board's own is_open flag.
  const seasonOpen = selectedCohort?.bulletin_open ?? true;
  const boardOpen = Boolean(selectedBoard?.is_open) && seasonOpen;

  // Reading is open across every season (migration 0008); posting, commenting
  // and reacting stay limited to seasons you took part in — admins included —
  // and (migration 0020) to open seasons and boards. The insert policies
  // enforce it, this keeps the UI honest about it.
  const isMember = Boolean(
    cohortId && currentUser?.cohort_ids.includes(cohortId),
  );
  const canParticipate = canPost && isMember;

  const mutationError = [
    createPostMutation.error,
    commentMutation.error,
    reactionMutation.error,
    postFlagMutation.error,
    deletePostMutation.error,
    commentFlagMutation.error,
    deleteCommentMutation.error,
    boardToggleMutation.error,
    deleteBoardMutation.error,
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

      {/* Only seasons that have a board. Rendered even for a single season — it
          names the season you are looking at. */}
      {seasonsWithBoards.length > 0 && (
        <SeasonTabs
          cohorts={seasonsWithBoards}
          selectedId={cohortId}
          onSelect={selectCohort}
        />
      )}

      <UnreadBar
        items={unreadPosts}
        currentBoardId={boardId}
        groupNameOf={groupNameOf}
        onOpen={openUnread}
      />

      {boardsLoading ? (
        <Typography color="text.secondary">{portalCopy.board.loading}</Typography>
      ) : boards.length === 0 ? (
        <Alert severity="info">{portalCopy.board.empty}</Alert>
      ) : (
        <>
          <BoardTabs
            boards={boards}
            counts={counts ?? {}}
            selectedId={boardId}
            onSelect={selectBoard}
            onEdit={isAdmin ? setEditingBoard : undefined}
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
                <Typography
                  color="text.secondary"
                  sx={{ mb: 2, whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                >
                  <LinkifiedText text={selectedBoard.description} />
                </Typography>
              )}

              {mutationError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {mutationError.message}
                </Alert>
              )}

              {isQa && (
                <>
                  <TextField
                    fullWidth
                    size="small"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={portalCopy.board.searchPlaceholder}
                    sx={{ mb: 2 }}
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon fontSize="small" />
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                  <BoardNotices
                    boardId={selectedBoard.id}
                    notices={notices ?? []}
                    canEdit={isAdmin || Boolean(currentUser?.is_volunteer)}
                    currentUserId={currentUser?.id ?? ""}
                    authorOf={authorOf}
                  />
                </>
              )}

              <Box
                sx={
                  isQa
                    ? { display: "flex", gap: 3, alignItems: "flex-start", flexDirection: { xs: "column", md: "row" } }
                    : undefined
                }
              >
                {isQa && (
                  <GroupSidebar
                    groups={groupList}
                    value={groupSel}
                    postCounts={postCounts}
                    mineCount={mineCount}
                    unreadByGroup={unreadByGroup}
                    mineUnread={mineUnread}
                    onSelect={selectGroup}
                  />
                )}
                <Box sx={{ flexGrow: 1, minWidth: 0, width: "100%" }}>
                  {isQa && query ? (
                    <QaSearchResults
                      query={query}
                      hits={searchHits}
                      groups={groupList}
                      mentorMatches={mentorMatches}
                      onOpenGroup={selectGroup}
                    />
                  ) : (
                    <>
                      {isQa && (
                        <Box sx={{ mb: 2 }}>
                          <Stack direction="row" alignItems="baseline" gap={1} flexWrap="wrap" sx={{ mb: activeGroup ? 1 : 0 }}>
                            <Typography variant="h6" fontWeight={700}>
                              {activeGroup?.name ?? portalCopy.board.groupMine}
                            </Typography>
                            {activeGroup && (
                              <Typography variant="body2" color="text.secondary">
                                {portalCopy.board.groupMentorCount(mentorsOfGroup(activeGroup.id).length)}
                              </Typography>
                            )}
                          </Stack>
                          {activeGroup ? (
                            <MentorStrip
                              mentors={mentorsOfGroup(activeGroup.id)}
                              onOpenProfile={setOpenProfile}
                            />
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              {portalCopy.board.groupMineHint}
                            </Typography>
                          )}
                        </Box>
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
              ) : (
                !selectedBoard.is_open && (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    {portalCopy.board.boardClosed}
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
                maxColumns={isQa ? 2 : 3}
                unreadByPost={unreadByPost}
                highlightPostId={focusPostId}
                mentorMustBeNamed={isQa && currentUser?.participant_role === "mentor"}
                groupNameOf={isQa && groupSel === MINE ? groupNameOf : undefined}
                emptyText={
                  isQa
                    ? groupSel === MINE
                      ? portalCopy.board.groupMineEmpty
                      : portalCopy.board.groupEmpty
                    : undefined
                }
              />
                    </>
                  )}
                </Box>
              </Box>

              <PostComposer
                open={composeOpen || editingPost !== null}
                board={selectedBoard}
                groups={groupList}
                defaultGroupId={activeGroup?.id ?? null}
                mentorsOfGroup={mentorsOfGroup}
                editing={editingPost}
                pending={
                  editingPost
                    ? editPostMutation.isPending
                    : createPostMutation.isPending
                }
                error={
                  (editingPost ? editPostMutation.error : createPostMutation.error)
                    ? ((editingPost
                        ? editPostMutation.error
                        : createPostMutation.error) as Error).message
                    : null
                }
                onClose={() => {
                  setComposeOpen(false);
                  setEditingPost(null);
                }}
                onSubmit={(draft) =>
                  editingPost
                    ? editPostMutation.mutate({ id: editingPost.id, draft })
                    : createPostMutation.mutate(draft)
                }
              />
            </>
          )}
        </>
      )}

      {isAdmin && (
        <>
          <BoardDialog
            open={createOpen || Boolean(editingBoard)}
            board={editingBoard}
            cohortId={cohortId ?? cohorts?.[0]?.id ?? ""}
            cohorts={cohorts ?? []}
            onClose={() => {
              setCreateOpen(false);
              setEditingBoard(null);
            }}
            onSaved={(board) => {
              setCreateOpen(false);
              setEditingBoard(null);
              queryClient.invalidateQueries({ queryKey: ["portal", "boards"] });
              selectBoard(board.id);
            }}
            onDelete={(board) => {
              setEditingBoard(null);
              setPendingDelete(board);
            }}
          />

          <Dialog
            open={Boolean(pendingDelete)}
            onClose={() => setPendingDelete(null)}
            maxWidth="xs"
            fullWidth
          >
            <DialogTitle>{portalCopy.board.deleteBoardTitle}</DialogTitle>
            <DialogContent>
              <DialogContentText>
                {pendingDelete
                  ? portalCopy.board.deleteBoardConfirm(
                      pendingDelete.name,
                      counts?.[pendingDelete.id] ?? 0,
                    )
                  : ""}
              </DialogContentText>
              {deleteBoardMutation.isError && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {(deleteBoardMutation.error as Error).message}
                </Alert>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setPendingDelete(null)}>
                {portalCopy.board.cancel}
              </Button>
              <Button
                color="error"
                variant="contained"
                disabled={deleteBoardMutation.isPending}
                onClick={() => {
                  if (pendingDelete) deleteBoardMutation.mutate(pendingDelete.id);
                }}
              >
                {portalCopy.board.deleteBoardAction}
              </Button>
            </DialogActions>
          </Dialog>
        </>
      )}

      <ProfileDialog
        profile={openProfile}
        onClose={() => setOpenProfile(null)}
        groupName={
          openProfile
            ? groupNameOf(
                groupMembers?.find((m) => m.profile_id === openProfile.id)?.group_id ?? null,
              )
            : undefined
        }
      />
    </Box>
  );
}
