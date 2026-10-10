"use client";

import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import { portalCopy } from "@/data/portalCopy";
import { useUnreadComments } from "@/components/portal/useUnreadComments";

const PREVIEW_LIMIT = 3;

/** 留言板新评论 strip on the portal home. Renders nothing when there is nothing new. */
export default function BoardReplyCard() {
  const copy = portalCopy.boardReplies;
  const { posts, total } = useUnreadComments();
  if (posts.length === 0) return null;

  const href = (post: (typeof posts)[number]) =>
    `/portal/board?cohort=${post.cohort_id}&board=${post.board_id}` +
    (post.group_id ? `&group=${post.group_id}` : "") +
    `&post=${post.post_id}`;

  return (
    <Paper
      sx={{ p: 2.5, mb: 3, borderRadius: 3, borderLeft: 4, borderColor: "info.main" }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
        <ForumOutlinedIcon color="info" />
        <Typography variant="h6" fontWeight={700}>
          {copy.title(total)}
        </Typography>
      </Stack>
      <Stack spacing={1}>
        {posts.slice(0, PREVIEW_LIMIT).map((post) => (
          <Stack
            key={post.post_id}
            direction="row"
            spacing={1.5}
            alignItems="center"
            justifyContent="space-between"
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography fontWeight={600} noWrap>
                {post.title || post.body}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {copy.newComments(post.unread_count)}
              </Typography>
            </Box>
            <Button component={Link} href={href(post)} size="small" variant="outlined" sx={{ flexShrink: 0 }}>
              {copy.go}
            </Button>
          </Stack>
        ))}
        {posts.length > PREVIEW_LIMIT && (
          <Typography variant="caption" color="text.secondary">
            {copy.more(posts.length - PREVIEW_LIMIT)}
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}
