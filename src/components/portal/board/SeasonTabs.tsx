"use client";

import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import Typography from "@mui/material/Typography";
import type { Cohort } from "@/types/portal";
import { portalCopy } from "@/data/portalCopy";

/**
 * Season row, above the board tabs. Styled deliberately unlike the board row —
 * tinted strip, smaller type, primary indicator — so two adjacent tab rows
 * don't read as one control.
 *
 * With a single season there is nothing to switch between, so it renders as a
 * static label instead of a one-item tab bar — the row still has to say which
 * season you are looking at.
 */
export default function SeasonTabs({
  cohorts,
  selectedId,
  isAdmin,
  onSelect,
  onToggleOpen,
}: {
  cohorts: Cohort[];
  selectedId: string | null;
  isAdmin: boolean;
  onSelect: (id: string) => void;
  onToggleOpen: (id: string, open: boolean) => void;
}) {
  const selected = cohorts.find((c) => c.id === selectedId) ?? null;

  return (
    <Box
      sx={{
        bgcolor: "background.default",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        px: 1.5,
        mb: 2,
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        gap={1}
      >
        <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ flexShrink: 0 }}
          >
            {portalCopy.board.seasonLabel}
          </Typography>
          {cohorts.length === 1 ? (
            <Stack
              direction="row"
              spacing={0.75}
              alignItems="center"
              sx={{ py: 1.25 }}
            >
              <Typography variant="body2" fontWeight={700}>
                {cohorts[0].name}
              </Typography>
              {!cohorts[0].bulletin_open && (
                <Chip
                  size="small"
                  label={portalCopy.board.seasonArchivedChip}
                  sx={{ height: 18, fontSize: 11 }}
                />
              )}
            </Stack>
          ) : (
          <Tabs
            value={selectedId ?? false}
            onChange={(_, value: string) => onSelect(value)}
            variant="scrollable"
            scrollButtons="auto"
            textColor="primary"
            indicatorColor="primary"
            sx={{
              minHeight: 40,
              "& .MuiTab-root": {
                minHeight: 40,
                fontSize: 13,
                px: 1.5,
                textTransform: "none",
              },
            }}
          >
            {cohorts.map((cohort) => (
              <Tab
                key={cohort.id}
                value={cohort.id}
                label={
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <Box component="span">{cohort.name}</Box>
                    {!cohort.bulletin_open && (
                      <Chip
                        size="small"
                        label={portalCopy.board.seasonArchivedChip}
                        sx={{ height: 18, fontSize: 11 }}
                      />
                    )}
                  </Stack>
                }
              />
            ))}
          </Tabs>
          )}
        </Stack>

        {isAdmin && selected && (
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={selected.bulletin_open}
                onChange={(e) => onToggleOpen(selected.id, e.target.checked)}
              />
            }
            label={
              <Typography variant="caption">
                {portalCopy.board.seasonOpenToggle}
              </Typography>
            }
            sx={{ mr: 0, flexShrink: 0 }}
          />
        )}
      </Stack>
    </Box>
  );
}
