"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Avatar from "@mui/material/Avatar";
import Typography from "@mui/material/Typography";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import Collapse from "@mui/material/Collapse";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import ScienceIcon from "@mui/icons-material/Science";
import CloseIcon from "@mui/icons-material/Close";
import type { Profile, UserRole } from "@/types/portal";
import { demoAccountIds } from "@/lib/portal/mockData";
import { getProfile, listProfiles, resetDemoData } from "@/lib/portal/store";
import { portalCopy, roleLabels } from "@/data/portalCopy";

type PortalSessionContextValue = {
  currentUser: Profile | null;
  loading: boolean;
  switchTo: (id: string) => void;
};

const PortalSessionContext =
  React.createContext<PortalSessionContextValue | null>(null);

const ACTIVE_ID_KEY = "taxing-portal-active-user";

export function PortalSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = React.useState<string>(demoAccountIds[0]);

  React.useEffect(() => {
    const stored = window.localStorage.getItem(ACTIVE_ID_KEY);
    if (stored) setActiveId(stored);
  }, []);

  const switchTo = React.useCallback((id: string) => {
    setActiveId(id);
    window.localStorage.setItem(ACTIVE_ID_KEY, id);
  }, []);

  const { data: currentUser, isLoading } = useQuery({
    queryKey: ["portal", "currentUser", activeId],
    queryFn: () => getProfile(activeId),
  });

  const value = React.useMemo<PortalSessionContextValue>(
    () => ({
      currentUser: currentUser ?? null,
      loading: isLoading,
      switchTo,
    }),
    [currentUser, isLoading, switchTo],
  );

  return (
    <PortalSessionContext.Provider value={value}>
      {children}
      <DevAccountSwitcher
        activeId={activeId}
        onSwitch={switchTo}
        onReset={() => {
          if (window.confirm(portalCopy.account.resetConfirm)) {
            resetDemoData();
            queryClient.invalidateQueries();
          }
        }}
      />
    </PortalSessionContext.Provider>
  );
}

export function usePortalSession(): PortalSessionContextValue {
  const ctx = React.useContext(PortalSessionContext);
  if (!ctx) {
    throw new Error("usePortalSession 必须在 PortalSessionProvider 内使用");
  }
  return ctx;
}

function DevAccountSwitcher({
  activeId,
  onSwitch,
  onReset,
}: {
  activeId: string;
  onSwitch: (id: string) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = React.useState(false);

  const { data: accounts } = useQuery({
    queryKey: ["portal", "demoAccounts"],
    queryFn: async () => {
      const all = await listProfiles();
      const byId = new Map(all.map((p) => [p.id, p]));
      return demoAccountIds
        .map((id) => byId.get(id))
        .filter((p): p is Profile => Boolean(p));
    },
  });

  return (
    <Box
      sx={{
        position: "fixed",
        bottom: 16,
        right: 16,
        zIndex: (t) => t.zIndex.tooltip + 1,
      }}
    >
      {!open && (
        <Tooltip title={portalCopy.account.switcher}>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<ScienceIcon />}
            onClick={() => setOpen(true)}
            sx={{ borderRadius: 8, boxShadow: 4 }}
          >
            演示身份
          </Button>
        </Tooltip>
      )}
      <Collapse in={open} unmountOnExit>
        <Paper elevation={8} sx={{ p: 2, width: 260, borderRadius: 3 }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ mb: 1 }}
          >
            <Typography variant="subtitle2" fontWeight={700}>
              {portalCopy.account.switcher}
            </Typography>
            <IconButton size="small" onClick={() => setOpen(false)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            仅用于原型演示，不是真实登录。
          </Typography>
          <ToggleButtonGroup
            orientation="vertical"
            exclusive
            fullWidth
            value={activeId}
            onChange={(_, id) => id && onSwitch(id)}
            sx={{ mt: 1.5 }}
          >
            {(accounts ?? []).map((acc) => (
              <ToggleButton key={acc.id} value={acc.id} sx={{ justifyContent: "flex-start", gap: 1.5, textTransform: "none" }}>
                <Avatar src={acc.avatar_url ?? undefined} sx={{ width: 28, height: 28 }} />
                <Box sx={{ textAlign: "left" }}>
                  <Typography variant="body2" fontWeight={600} lineHeight={1.2}>
                    {acc.full_name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {roleLabels[acc.role as UserRole]}
                  </Typography>
                </Box>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Button
            fullWidth
            size="small"
            color="inherit"
            startIcon={<RestartAltIcon />}
            onClick={onReset}
            sx={{ mt: 1.5 }}
          >
            {portalCopy.account.reset}
          </Button>
        </Paper>
      </Collapse>
    </Box>
  );
}
