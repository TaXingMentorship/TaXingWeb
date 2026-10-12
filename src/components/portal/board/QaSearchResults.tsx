"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { MentorGroup, Profile } from "@/types/portal";
import { portalCopy } from "@/data/portalCopy";

export type SearchHit = {
  postId: string;
  groupId: string | null;
  title: string | null;
  snippet: string;
  mentorReplied: boolean;
};

/** Wraps each occurrence of `query` in a highlight. Plain text only — no innerHTML. */
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  // Split on the original text, not a lowercased copy: lowercasing can change a
  // string's length (e.g. 「İ」), which would shift every index after it.
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <Box component="mark" key={i} sx={{ bgcolor: "warning.light", color: "inherit", px: 0.25 }}>
            {part}
          </Box>
        ) : (
          part
        ),
      )}
    </>
  );
}

/**
 * Board-wide search results. Group chips narrow the results that were already
 * found; they are facets with counts, not a scope switch. Picking a result
 * opens its group (or 「未分组」) scrolled to the post with its comments open.
 */
export default function QaSearchResults({
  query,
  hits,
  groups,
  mentorMatches,
  onOpenGroup,
  onOpenPost,
}: {
  query: string;
  hits: SearchHit[];
  groups: MentorGroup[];
  /** Mentors whose name matches, with the group they sit in. */
  mentorMatches: { profile: Profile; groupId: string | null }[];
  onOpenGroup: (groupId: string) => void;
  onOpenPost: (groupId: string | null, postId: string) => void;
}) {
  const copy = portalCopy.board;
  const [facet, setFacet] = React.useState<string>("all");
  const groupName = (id: string | null) => groups.find((g) => g.id === id)?.name;

  const facets = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const hit of hits) {
      if (hit.groupId) counts.set(hit.groupId, (counts.get(hit.groupId) ?? 0) + 1);
    }
    return groups.filter((g) => counts.has(g.id)).map((g) => ({ group: g, count: counts.get(g.id)! }));
  }, [hits, groups]);

  // A facet that the new query no longer has falls back to showing everything.
  const activeFacet = facets.some((f) => f.group.id === facet) ? facet : "all";
  const shown = activeFacet === "all" ? hits : hits.filter((h) => h.groupId === activeFacet);

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {copy.searchResults(query, hits.length, facets.length)}
      </Typography>

      {mentorMatches.map(({ profile, groupId }) => (
        <Stack key={profile.id} direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {copy.searchMentorIn(
              profile.full_name ?? "",
              (groupId && groupName(groupId)) || portalCopy.mentorGroups.unassigned,
            )}
          </Typography>
          {groupId && (
            <Link
              component="button"
              type="button"
              variant="body2"
              underline="hover"
              color="secondary.dark"
              onClick={() => onOpenGroup(groupId)}
            >
              {copy.searchGoToGroup}
            </Link>
          )}
        </Stack>
      ))}

      {facets.length > 0 && (
        <Stack direction="row" gap={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
          <Chip
            size="small"
            label={`${copy.searchAllGroups} ${hits.length}`}
            color={activeFacet === "all" ? "secondary" : "default"}
            onClick={() => setFacet("all")}
          />
          {facets.map(({ group, count }) => (
            <Chip
              key={group.id}
              size="small"
              label={`${group.name} ${count}`}
              color={activeFacet === group.id ? "secondary" : "default"}
              onClick={() => setFacet(group.id)}
            />
          ))}
        </Stack>
      )}

      {shown.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 3 }}>
          {copy.searchEmpty}
        </Typography>
      ) : (
        <Stack divider={<Divider flexItem />}>
          {shown.map((hit) => (
            <Box
              key={hit.postId}
              role="button"
              tabIndex={0}
              onClick={() => onOpenPost(hit.groupId, hit.postId)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpenPost(hit.groupId, hit.postId);
                }
              }}
              sx={{ py: 1.5, cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }}
            >
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.5 }}>
                <Chip
                  size="small"
                  color="secondary"
                  label={groupName(hit.groupId) ?? copy.groupUngrouped}
                />
                {hit.mentorReplied && (
                  <Chip size="small" color="success" label={copy.mentorReplied} />
                )}
              </Stack>
              {hit.title && (
                <Typography fontWeight={700}>
                  <Highlight text={hit.title} query={query} />
                </Typography>
              )}
              <Typography variant="body2" color="text.secondary" sx={{ wordBreak: "break-word" }}>
                <Highlight text={hit.snippet} query={query} />
              </Typography>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}
