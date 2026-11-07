"use client";

import * as React from "react";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { MentorGroup, RosterInvite } from "@/types/portal";
import type { InviteState, MemberRowData } from "@/lib/portal/rosterEntries";
import { portalCopy, profileLabels } from "@/data/portalCopy";
import IdentityCell from "@/components/portal/IdentityCell";

// 昵称 / 微信号 / 邮箱 size to their longest value on the page and never wrap:
// `width: 1%` asks the table for the narrowest column, `nowrap` stops it going
// below the longest line. So the width follows the data, with no magic numbers.
const fitCellSx = { width: "1%", whiteSpace: "nowrap" } as const;

export const nameCellSx = fitCellSx;
export const wechatCellSx = fitCellSx;
/** 身份: all chips on one line. */
export const identityCellSx = fitCellSx;
/** 推荐: the 👍 and 往期 chips on one line. */
export const recommendCellSx = fitCellSx;
/** 邮箱 keeps two extra characters of room after the longest address. */
export const emailCellSx = { ...fitCellSx, pr: "calc(16px + 2ch)" } as const;

/** 备注 takes all the width the fitted columns leave (never under 300px). */
export const notesCellSx = { minWidth: 300, width: "100%" } as const;

/** Rows dimmed for people who will not take part. A TableCell sets its own
 *  colour, so it has to be set on the cells: colour on the row alone is ignored. */
export const dimmedRowSx = {
  bgcolor: "action.selected",
  "& > .MuiTableCell-root": { color: "text.secondary" },
} as const;

const Dash = () => (
  <Typography variant="body2" color="text.secondary" component="span">
    —
  </Typography>
);

function TriState({
  value,
  yes,
  no,
  noColor,
}: {
  value: boolean | null;
  yes: string;
  no: string;
  noColor: "warning" | "default";
}) {
  if (value === null) return <Dash />;
  return value ? (
    <Chip size="small" color="success" label={yes} />
  ) : (
    <Chip size="small" color={noColor} variant="outlined" label={no} />
  );
}

export function MemberRow({
  row,
  groups,
  groupId,
  selected,
  onSelect,
  assigning,
  onAssign,
  recommendCell,
  notesCell,
}: {
  row: MemberRowData;
  groups: MentorGroup[];
  groupId: string | undefined;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  assigning: boolean;
  onAssign: (groupId: string | null) => void;
  /** 推荐 (mentors only; anything else shows a dash). */
  recommendCell: React.ReactNode;
  notesCell: React.ReactNode;
}) {
  const { profile, sessionCount, submitted, gaveGratitude, completedAll } = row;
  const groupCopy = portalCopy.mentorGroups;
  const stateCopy = portalCopy.rosterTable.state;
  const isMentor = profile.participant_role === "mentor";

  return (
    <TableRow hover>
      <TableCell padding="checkbox">
        {isMentor && (
          <Checkbox
            size="small"
            checked={selected}
            onChange={(e) => onSelect(e.target.checked)}
            slotProps={{ input: { "aria-label": `选择 ${profile.full_name ?? ""}` } }}
          />
        )}
      </TableCell>
      <TableCell>
        <Typography
          variant="caption"
          color="text.secondary"
          title={profile.id}
          noWrap
          sx={{ display: "block", maxWidth: 88 }}
        >
          {profile.id}
        </Typography>
      </TableCell>
      <TableCell sx={nameCellSx}>{profile.full_name ?? "—"}</TableCell>
      <TableCell sx={emailCellSx}>{profile.email ?? "—"}</TableCell>
      <TableCell sx={wechatCellSx}>{profile.wechat_number ?? "—"}</TableCell>
      <TableCell sx={identityCellSx}>
        <IdentityCell profile={profile} />
      </TableCell>
      <TableCell>
        <Chip size="small" color="success" label={stateCopy.active} />
      </TableCell>
      <TableCell sx={{ maxWidth: 220 }}>
        {isMentor ? (
          <TextField
            select
            size="small"
            fullWidth
            sx={{
              "& .MuiSelect-select": {
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              },
            }}
            value={groupId ?? ""}
            disabled={assigning}
            onChange={(e) => onAssign(e.target.value || null)}
            error={!groupId}
            slotProps={{
              select: {
                displayEmpty: true,
                renderValue: (value) =>
                  groups.find((g) => g.id === value)?.name ?? groupCopy.unassigned,
              },
            }}
          >
            <MenuItem value="">{groupCopy.unassigned}</MenuItem>
            {groups.map((g) => (
              <MenuItem key={g.id} value={g.id}>
                {g.name}
              </MenuItem>
            ))}
          </TextField>
        ) : (
          <Dash />
        )}
      </TableCell>
      <TableCell align="right">{sessionCount}</TableCell>
      <TableCell align="center">
        <TriState value={submitted} yes="已提交" no="未提交" noColor="warning" />
      </TableCell>
      <TableCell align="center">
        <TriState value={gaveGratitude} yes="已提供" no="未提供" noColor="default" />
      </TableCell>
      <TableCell align="center">
        <TriState value={completedAll} yes="已完成" no="未完成" noColor="default" />
      </TableCell>
      <TableCell sx={recommendCellSx}>{isMentor ? recommendCell : <Dash />}</TableCell>
      <TableCell sx={notesCellSx}>{notesCell}</TableCell>
    </TableRow>
  );
}

/** A person with no profile yet: invited, or activated but not onboarded. */
/** The 状态 chip for a person with no profile in the season. */
export function InviteStateChip({ state }: { state: InviteState }) {
  const stateCopy = portalCopy.rosterTable.state;
  switch (state) {
    case "setup":
      return <Chip size="small" color="info" variant="outlined" label={stateCopy.setup} />;
    case "account":
      return <Chip size="small" color="secondary" variant="outlined" label={stateCopy.account} />;
    case "out":
      return <Chip size="small" color="default" label={stateCopy.out} />;
    default:
      return <Chip size="small" color="warning" variant="outlined" label={stateCopy.waiting} />;
  }
}

export function InvitedRow({ invite, state }: { invite: RosterInvite; state: InviteState }) {

  return (
    <TableRow hover sx={state === "out" ? dimmedRowSx : undefined}>
      <TableCell padding="checkbox" />
      <TableCell>
        <Dash />
      </TableCell>
      <TableCell sx={nameCellSx}>{invite.full_name ?? "—"}</TableCell>
      <TableCell sx={emailCellSx}>{invite.email}</TableCell>
      <TableCell>
        <Dash />
      </TableCell>
      <TableCell sx={identityCellSx}>
        <Stack direction="row" spacing={0.5} flexWrap="nowrap" useFlexGap>
          {profileLabels(invite).map((label) => (
            <Chip key={label} size="small" variant="outlined" label={label} />
          ))}
        </Stack>
      </TableCell>
      <TableCell>
        <InviteStateChip state={state} />
      </TableCell>
      <TableCell>
        <Dash />
      </TableCell>
      <TableCell align="right">
        <Dash />
      </TableCell>
      <TableCell align="center">
        <Dash />
      </TableCell>
      <TableCell align="center">
        <Dash />
      </TableCell>
      <TableCell align="center">
        <Dash />
      </TableCell>
      <TableCell>
        <Dash />
      </TableCell>
      <TableCell>
        <Dash />
      </TableCell>
    </TableRow>
  );
}
