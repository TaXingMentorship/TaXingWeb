"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { MentorRecommendation, RosterNoteEntry, RosterStaffAuthor } from "@/types/portal";
import { portalCopy, profileLabels } from "@/data/portalCopy";
import MemberAvatar from "./MemberAvatar";

type AuthorDirectory = {
  byId: Map<string, RosterStaffAuthor>;
  /** This season's activity per author. */
  stats: Map<string, { notes: number; recs: number }>;
};

const AuthorsContext = React.createContext<AuthorDirectory>({
  byId: new Map(),
  stats: new Map(),
});

/** Who wrote the season's notes / recommendations, for author names below it. */
export function RosterAuthorsProvider({
  authors,
  noteEntries,
  recommendations,
  cohortId,
  children,
}: {
  authors: RosterStaffAuthor[];
  noteEntries: RosterNoteEntry[];
  recommendations: MentorRecommendation[];
  cohortId: string;
  children: React.ReactNode;
}) {
  const value = React.useMemo<AuthorDirectory>(() => {
    const stats = new Map<string, { notes: number; recs: number }>();
    const bump = (id: string, key: "notes" | "recs") => {
      const s = stats.get(id) ?? { notes: 0, recs: 0 };
      s[key] += 1;
      stats.set(id, s);
    };
    for (const e of noteEntries) if (e.author_id) bump(e.author_id, "notes");
    for (const r of recommendations) if (r.cohort_id === cohortId) bump(r.recommender_id, "recs");
    return { byId: new Map(authors.map((a) => [a.id, a])), stats };
  }, [authors, noteEntries, recommendations, cohortId]);
  return <AuthorsContext.Provider value={value}>{children}</AuthorsContext.Provider>;
}

export function useRosterAuthor(id: string | null) {
  const { byId } = React.useContext(AuthorsContext);
  return id ? byId.get(id) : undefined;
}

function AuthorCard({ author }: { author: RosterStaffAuthor }) {
  const copy = portalCopy.roster;
  const { stats } = React.useContext(AuthorsContext);
  const s = stats.get(author.id);
  const activity = s ? copy.authorCardActivity(s.notes, s.recs) : "";
  return (
    <Stack spacing={1} sx={{ minWidth: 200 }}>
      <Stack direction="row" spacing={1.25} alignItems="center">
        <MemberAvatar src={author.avatar_url ?? undefined} sx={{ width: 40, height: 40 }} />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" fontWeight={800} noWrap>
            {author.full_name ?? copy.noteUnknownAuthor}
          </Typography>
          <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ mt: 0.25 }}>
            {profileLabels(author).map((label) => (
              <Chip key={label} size="small" variant="outlined" label={label} sx={{ height: 20 }} />
            ))}
          </Stack>
        </Box>
      </Stack>
      {(author.email || author.wechat_number) && (
        <Box
          component="dl"
          sx={{
            m: 0,
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            columnGap: 1,
            rowGap: 0.25,
            typography: "caption",
            "& dt": { color: "text.secondary" },
            "& dd": { m: 0, wordBreak: "break-all", userSelect: "all" },
          }}
        >
          {author.email && (
            <>
              <dt>{copy.authorCardEmail}</dt>
              <dd>{author.email}</dd>
            </>
          )}
          {author.wechat_number && (
            <>
              <dt>{copy.authorCardWechat}</dt>
              <dd>{author.wechat_number}</dd>
            </>
          )}
        </Box>
      )}
      {activity && (
        <Typography variant="caption" color="text.secondary">
          {activity}
        </Typography>
      )}
    </Stack>
  );
}

/**
 * A note author's or recommender's name. Hover (or tap / focus) shows a card
 * with their avatar, identity, contact and this season's activity.
 */
export function RosterAuthorName({
  id,
  fallback,
  variant = "caption",
}: {
  id: string | null;
  /** Shown when there is no author profile (早期备注, or a deleted account). */
  fallback: string;
  variant?: "caption" | "body2";
}) {
  const author = useRosterAuthor(id);
  const name = author?.full_name?.trim() || fallback;
  if (!author) {
    return (
      <Typography variant={variant} component="span" fontWeight={700} color="text.primary">
        {name}
      </Typography>
    );
  }
  return (
    <Tooltip
      title={<AuthorCard author={author} />}
      arrow
      placement="top-start"
      enterDelay={200}
      leaveDelay={100}
      enterTouchDelay={0}
      leaveTouchDelay={5000}
      slotProps={{
        tooltip: {
          sx: {
            bgcolor: "background.paper",
            color: "text.primary",
            boxShadow: 4,
            border: 1,
            borderColor: "divider",
            p: 1.5,
            maxWidth: 300,
          },
        },
        arrow: { sx: { color: "background.paper", "&::before": { border: 1, borderColor: "divider" } } },
      }}
    >
      <Typography
        variant={variant}
        component="span"
        fontWeight={700}
        color="text.primary"
        tabIndex={0}
        sx={{
          cursor: "help",
          borderBottom: "1px dotted",
          borderColor: "text.disabled",
          "&:hover, &:focus-visible": { color: "primary.main", borderColor: "primary.main", outline: "none" },
        }}
      >
        {name}
      </Typography>
    </Tooltip>
  );
}
