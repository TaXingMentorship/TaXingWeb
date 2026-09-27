"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import CloseIcon from "@mui/icons-material/Close";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import type { Profile } from "@/types/portal";
import { profileLabels } from "@/data/portalCopy";

/**
 * Read-only view of one member's profile. Shared by the directory cards and
 * the bulletin board (clicking a non-anonymous author's avatar).
 */
export default function ProfileDialog({
  profile,
  onClose,
}: {
  profile: Profile | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={Boolean(profile)} onClose={onClose} maxWidth="sm" fullWidth>
      {profile && (
        <>
          <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Avatar src={profile.avatar_url ?? undefined} sx={{ width: 56, height: 56 }} />
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h6" fontWeight={800}>
                {profile.full_name}
              </Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                {profileLabels(profile).map((label) => (
                  <Chip key={label} size="small" label={label} color="secondary" />
                ))}
              </Stack>
            </Box>
            <IconButton onClick={onClose} aria-label="关闭">
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers>
            <Field label="领域" value={profile.field} />
            <Field label="简介" value={profile.bio} />
            <Field label="学术经历 / 行业经历" value={profile.background} />
            {profile.participant_role === "mentor" && (
              <>
                <Field label="工作年限" value={profile.years_experience} />
                <Field label="可以帮助的 mentee 数量" value={profile.mentee_capacity} />
                <Field label="对 mentee 的期望" value={profile.mentee_expectations} />
                <Field label="擅长与不擅长的话题" value={profile.topics} />
              </>
            )}
            {profile.participant_role === "mentee" && (
              <Field label="问题 / 想获得的帮助" value={profile.help_needed} />
            )}
            {profile.interests.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  兴趣方向
                </Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {profile.interests.map((i) => (
                    <Chip key={i} label={i} size="small" />
                  ))}
                </Stack>
              </Box>
            )}
            {profile.linkedin && (
              <Link
                href={profile.linkedin}
                target="_blank"
                rel="noopener"
                sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
              >
                <LinkedInIcon fontSize="small" /> LinkedIn 主页
              </Link>
            )}
          </DialogContent>
        </>
      )}
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        {label}
      </Typography>
      <Typography variant="body1">{value}</Typography>
    </Box>
  );
}
