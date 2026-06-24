"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Avatar from "@mui/material/Avatar";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import Alert from "@mui/material/Alert";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import SendIcon from "@mui/icons-material/Send";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import type { BulletinCategory, BulletinPost, Profile } from "@/types/portal";
import {
  createPost,
  getBoard,
  listPosts,
  listProfiles,
  setPostHidden,
} from "@/lib/portal/store";
import { categoryColors, categoryLabels, portalCopy } from "@/data/portalCopy";
import { usePortalSession } from "@/components/portal/PortalSessionProvider";

const categories: BulletinCategory[] = ["wish", "thanks", "growth", "other"];

export default function BoardDetailPage() {
  const params = useParams<{ boardId: string }>();
  const boardId = params.boardId;
  const { currentUser } = usePortalSession();
  const queryClient = useQueryClient();
  const isAdmin = currentUser?.role === "admin";

  const [filter, setFilter] = React.useState<BulletinCategory | "all">("all");
  const [body, setBody] = React.useState("");
  const [category, setCategory] = React.useState<BulletinCategory>("wish");

  const { data: board, isLoading: boardLoading } = useQuery({
    queryKey: ["portal", "board", boardId],
    queryFn: () => getBoard(boardId),
  });

  const { data: posts } = useQuery({
    queryKey: ["portal", "posts", boardId, isAdmin],
    queryFn: () => listPosts({ boardId, includeHidden: isAdmin }),
    enabled: Boolean(boardId),
  });

  const { data: profiles } = useQuery({
    queryKey: ["portal", "profiles"],
    queryFn: () => listProfiles(),
  });

  const authorOf = (id: string): Profile | undefined =>
    profiles?.find((p) => p.id === id);

  const createMutation = useMutation({
    mutationFn: () =>
      createPost({
        cohort_id: board!.cohort_id,
        board_id: boardId,
        author_id: currentUser!.id,
        category,
        body: body.trim(),
      }),
    onSuccess: () => {
      setBody("");
      queryClient.invalidateQueries({ queryKey: ["portal", "posts"] });
      queryClient.invalidateQueries({ queryKey: ["portal", "boardCounts"] });
    },
  });

  const hideMutation = useMutation({
    mutationFn: ({ id, hidden }: { id: string; hidden: boolean }) =>
      setPostHidden(id, hidden),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal", "posts"] });
      queryClient.invalidateQueries({ queryKey: ["portal", "boardCounts"] });
    },
  });

  const backLink = (
    <Button
      component={Link}
      href="/portal/board"
      startIcon={<ArrowBackIcon />}
      sx={{ mb: 2 }}
    >
      {portalCopy.board.backToList}
    </Button>
  );

  if (!boardLoading && !board) {
    return (
      <Box sx={{ maxWidth: 760 }}>
        {backLink}
        <Alert severity="error">找不到该留言板。</Alert>
      </Box>
    );
  }

  const bulletinOpen = board?.is_open ?? false;
  const filteredPosts = (posts ?? []).filter((p) =>
    filter === "all" ? true : p.category === filter,
  );

  return (
    <Box sx={{ maxWidth: 760 }}>
      {backLink}

      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <Typography variant="h4" fontWeight={800}>
          {board?.name ?? "加载中…"}
        </Typography>
        {board && !board.is_open && (
          <Chip size="small" label={portalCopy.board.closed} />
        )}
      </Stack>
      {board?.description && (
        <Typography color="text.secondary" sx={{ mb: 2, mt: 0.5 }}>
          {board.description}
        </Typography>
      )}

      <Paper sx={{ p: 2.5, borderRadius: 3, mb: 3, mt: 2 }}>
        {bulletinOpen ? (
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Avatar src={currentUser?.avatar_url ?? undefined} />
              <TextField
                select
                size="small"
                label="类别"
                value={category}
                onChange={(e) => setCategory(e.target.value as BulletinCategory)}
                sx={{ minWidth: 140 }}
              >
                {categories.map((c) => (
                  <MenuItem key={c} value={c}>
                    {categoryLabels[c]}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            <TextField
              placeholder="分享你的想法…"
              multiline
              minRows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              fullWidth
            />
            <Box sx={{ textAlign: "right" }}>
              <Button
                variant="contained"
                color="secondary"
                endIcon={<SendIcon />}
                disabled={!body.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                发布
              </Button>
            </Box>
          </Stack>
        ) : (
          <Alert severity="warning">该留言板当前已关闭，仅可浏览。</Alert>
        )}
      </Paper>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        <Chip
          label="全部"
          color={filter === "all" ? "secondary" : "default"}
          onClick={() => setFilter("all")}
        />
        {categories.map((c) => (
          <Chip
            key={c}
            label={categoryLabels[c]}
            color={filter === c ? "secondary" : "default"}
            onClick={() => setFilter(c)}
          />
        ))}
      </Stack>

      <Stack spacing={2}>
        {filteredPosts.length === 0 ? (
          <Alert severity="info">还没有留言，来发布第一条吧！</Alert>
        ) : (
          filteredPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              author={authorOf(post.author_id)}
              isAdmin={isAdmin}
              onToggleHidden={() =>
                hideMutation.mutate({ id: post.id, hidden: !post.hidden })
              }
            />
          ))
        )}
      </Stack>
    </Box>
  );
}

function PostCard({
  post,
  author,
  isAdmin,
  onToggleHidden,
}: {
  post: BulletinPost;
  author: Profile | undefined;
  isAdmin: boolean;
  onToggleHidden: () => void;
}) {
  return (
    <Paper
      sx={{
        p: 2.5,
        borderRadius: 3,
        opacity: post.hidden ? 0.6 : 1,
        border: post.hidden ? "1px dashed" : "none",
        borderColor: "warning.main",
      }}
    >
      <Stack direction="row" spacing={2} alignItems="flex-start">
        <Avatar src={author?.avatar_url ?? undefined} />
        <Box sx={{ flexGrow: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography fontWeight={700}>{author?.full_name ?? "匿名"}</Typography>
            <Chip
              size="small"
              label={categoryLabels[post.category]}
              color={categoryColors[post.category]}
              variant="outlined"
            />
            {post.hidden && <Chip size="small" color="warning" label="已隐藏" />}
            <Typography variant="caption" color="text.secondary">
              {new Date(post.created_at).toLocaleString("zh-CN")}
            </Typography>
          </Stack>
          <Typography sx={{ mt: 1, whiteSpace: "pre-wrap" }}>{post.body}</Typography>
        </Box>
        {isAdmin && (
          <Tooltip title={post.hidden ? "取消隐藏" : "隐藏此留言"}>
            <IconButton onClick={onToggleHidden} size="small">
              {post.hidden ? <VisibilityIcon /> : <VisibilityOffIcon />}
            </IconButton>
          </Tooltip>
        )}
      </Stack>
    </Paper>
  );
}
