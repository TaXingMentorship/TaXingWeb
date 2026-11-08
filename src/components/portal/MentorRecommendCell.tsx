"use client";

import * as React from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import ThumbUpOutlinedIcon from "@mui/icons-material/ThumbUpOutlined";
import type { MentorRecommendation } from "@/types/portal";
import { portalCopy } from "@/data/portalCopy";
import { RosterAuthorName } from "./RosterAuthorCard";
import { shortDate } from "./RosterNoteThread";

/**
 * The 推荐 chip warms up with this season's recommendation count: grey at 0,
 * then amber → orange → red, with a halo and slightly larger size from 3 up, so a mentor many people vouched for stands
 * out in a long list. Index = min(count, 5); text is dark until the fill is
 * strong enough for white.
 */
const HEAT: { bg: string; border: string; fg: string; shadow?: string }[] = [
  { bg: "transparent", border: "", fg: "" }, // 0: MUI default outlined chip
  { bg: "#ffd54f", border: "#ffb300", fg: "#4e3200" },
  { bg: "#ffa726", border: "#f57c00", fg: "#3e1f00" },
  { bg: "#f4511e", border: "#d84315", fg: "#ffffff", shadow: "0 0 0 3px rgba(244, 81, 30, 0.22)" },
  { bg: "#d32f2f", border: "#b71c1c", fg: "#ffffff", shadow: "0 0 0 4px rgba(211, 47, 47, 0.28)" },
  { bg: "#b71c1c", border: "#7f0000", fg: "#ffffff", shadow: "0 0 0 5px rgba(183, 28, 28, 0.35)" },
];

/**
 * 推荐 for one mentor: this season's count (filled when the viewer has
 * recommended), past seasons' count, and a dialog with every recommendation
 * and the viewer's own (recommend / update reason / withdraw).
 */
export default function MentorRecommendCell({
  mentorName,
  cohortId,
  viewerId,
  recommendations,
  onSet,
  onRemove,
}: {
  mentorName: string;
  cohortId: string;
  viewerId: string | null;
  recommendations: MentorRecommendation[];
  onSet: (reason: string | null) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const copy = portalCopy.roster;
  const current = recommendations.filter((r) => r.cohort_id === cohortId);
  const past = recommendations.filter((r) => r.cohort_id !== cohortId);
  const mine = current.find((r) => r.recommender_id === viewerId);
  const level = Math.min(current.length, HEAT.length - 1);
  const heat = HEAT[level];

  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(false);

  const openDialog = () => {
    setReason(mine?.reason ?? "");
    setError(false);
    setOpen(true);
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(false);
    try {
      await action();
      setOpen(false);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const pastBySeason = new Map<string, MentorRecommendation[]>();
  for (const r of past) {
    pastBySeason.set(r.cohort_name, [...(pastBySeason.get(r.cohort_name) ?? []), r]);
  }

  return (
    <>
      <Stack direction="row" spacing={0.5} alignItems="center" useFlexGap flexWrap="nowrap">
        <Chip
          size="small"
          clickable
          onClick={openDialog}
          variant="outlined"
          icon={mine ? <ThumbUpIcon /> : <ThumbUpOutlinedIcon />}
          label={copy.recommendButton(current.length)}
          sx={
            heat.fg
              ? {
                  bgcolor: heat.bg,
                  borderColor: heat.border,
                  color: heat.fg,
                  fontWeight: 800,
                  boxShadow: heat.shadow,
                  transform: `scale(${1 + (level - 1) * 0.04})`,
                  transformOrigin: "left center",
                  mr: level >= 3 ? 0.5 : 0,
                  "& .MuiChip-icon": { color: "inherit" },
                  "&:hover": { bgcolor: heat.bg, filter: "brightness(0.96)" },
                }
              : undefined
          }
        />
        {past.length > 0 && (
          <Chip
            size="small"
            clickable
            onClick={openDialog}
            color="secondary"
            variant="outlined"
            label={copy.recommendPast(past.length)}
          />
        )}
      </Stack>

      <Dialog open={open} onClose={() => !busy && setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{copy.recommendDialogTitle(mentorName)}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {copy.recommendDialogHint}
          </Typography>

          <Typography variant="subtitle2" gutterBottom>
            {copy.recommendThisSeason}（{current.length}）
          </Typography>
          <RecommendationList items={current} />

          {past.length > 0 && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" gutterBottom>
                {copy.recommendPastSeasons}（{past.length}）
              </Typography>
              {[...pastBySeason].map(([season, items]) => (
                <Stack key={season} sx={{ mb: 1 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>
                    {season}
                  </Typography>
                  <RecommendationList items={items} />
                </Stack>
              ))}
            </>
          )}

          <Divider sx={{ my: 2 }} />
          <TextField
            label={copy.recommendReasonLabel}
            placeholder={copy.recommendReasonPlaceholder}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            multiline
            minRows={2}
            fullWidth
            disabled={busy}
            slotProps={{ htmlInput: { maxLength: 500 } }}
          />
          {error && (
            <Alert severity="error" sx={{ mt: 1.5 }}>
              {copy.recommendError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          {mine && (
            <Button color="error" disabled={busy} onClick={() => run(onRemove)} sx={{ mr: "auto" }}>
              {copy.recommendWithdraw}
            </Button>
          )}
          <Button disabled={busy} onClick={() => setOpen(false)}>
            {copy.recommendClose}
          </Button>
          <Button
            variant="contained"
            disabled={busy}
            startIcon={<ThumbUpIcon />}
            onClick={() => run(() => onSet(reason.trim() || null))}
          >
            {mine ? copy.recommendUpdate : copy.recommendSubmit}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function RecommendationList({ items }: { items: MentorRecommendation[] }) {
  const copy = portalCopy.roster;
  if (items.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {copy.recommendNone}
      </Typography>
    );
  }
  return (
    <Stack spacing={0.75}>
      {items.map((r) => (
        <Typography key={r.id} variant="body2" component="div">
          <RosterAuthorName
            id={r.recommender_id}
            fallback={r.recommender_name?.trim() || copy.noteUnknownAuthor}
            variant="body2"
          />
          <Typography component="span" variant="caption" color="text.secondary">
            {" · "}
            {shortDate(r.updated_at)}
          </Typography>
          <Typography
            component="div"
            variant="body2"
            color={r.reason ? "text.primary" : "text.secondary"}
            sx={{ whiteSpace: "pre-wrap" }}
          >
            {r.reason ?? copy.recommendNoReason}
          </Typography>
        </Typography>
      ))}
    </Stack>
  );
}
