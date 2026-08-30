"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Avatar from "@mui/material/Avatar";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import IconButton from "@mui/material/IconButton";
import AppBar from "@mui/material/AppBar";
import MenuIcon from "@mui/icons-material/Menu";
import HomeIcon from "@mui/icons-material/Home";
import GroupsIcon from "@mui/icons-material/Groups";
import PersonIcon from "@mui/icons-material/Person";
import ForumIcon from "@mui/icons-material/Forum";
import EventIcon from "@mui/icons-material/Event";
import ListAltIcon from "@mui/icons-material/ListAlt";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import InsightsIcon from "@mui/icons-material/Insights";
import LogoutIcon from "@mui/icons-material/Logout";
import CircularProgress from "@mui/material/CircularProgress";
import { useTheme } from "@mui/material/styles";
import { portalCopy, profileLabels } from "@/data/portalCopy";
import { usePortalSession } from "@/components/portal/PortalSessionProvider";

const DRAWER_WIDTH = 248;

type NavItem = {
  label: string;
  path: string;
  icon: React.ReactNode;
  access: "all" | "participant" | "admin";
};

const navItems: NavItem[] = [
  { label: portalCopy.nav.home, path: "/portal", icon: <HomeIcon />, access: "all" },
  { label: portalCopy.nav.me, path: "/portal/me", icon: <PersonIcon />, access: "all" },
  { label: portalCopy.nav.activities, path: "/portal/activities", icon: <EventIcon />, access: "all" },
  { label: portalCopy.nav.directory, path: "/portal/directory", icon: <GroupsIcon />, access: "all" },
  { label: portalCopy.nav.progress, path: "/portal/admin/sessions", icon: <InsightsIcon />, access: "participant" },
  { label: portalCopy.nav.board, path: "/portal/board", icon: <ForumIcon />, access: "all" },
  { label: portalCopy.nav.roster, path: "/portal/admin/roster", icon: <ListAltIcon />, access: "admin" },
  { label: portalCopy.nav.adminImport, path: "/portal/admin/import", icon: <UploadFileIcon />, access: "admin" },
];

export default function PortalShell({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const pathname = usePathname();
  const { currentUser, loading, signOut } = usePortalSession();

  if (
    pathname === "/portal/login" ||
    pathname === "/portal/auth/callback" ||
    pathname === "/portal/onboarding" ||
    pathname.startsWith("/portal/password/")
  ) {
    return <>{children}</>;
  }

  const visibleItems = navItems.filter(
    (item) =>
      currentUser &&
      (item.access === "all" ||
        (item.access === "admin" && currentUser.is_admin) ||
        (item.access === "participant" &&
          (currentUser.is_admin || currentUser.participant_role))),
  );

  const drawerContent = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Box sx={{ px: 2.5, py: 2.5 }}>
        <Typography variant="h6" fontWeight={800} color="secondary.main">
          {portalCopy.brand}
        </Typography>
        <Chip
          size="small"
          label={portalCopy.prototypeBadge}
          color="warning"
          variant="outlined"
          sx={{ mt: 1 }}
        />
      </Box>
      <Divider />
      {currentUser && (
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ px: 2.5, py: 2 }}>
          <Avatar src={currentUser.avatar_url ?? undefined} />
          <Box>
            <Typography variant="body1" fontWeight={700} lineHeight={1.2}>
              {currentUser.full_name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {portalCopy.account.loggedInAs}：{profileLabels(currentUser).join(" · ")}
            </Typography>
          </Box>
        </Stack>
      )}
      <Divider />
      <List sx={{ flexGrow: 1, px: 1 }}>
        {visibleItems.map((item) => {
          const selected =
            item.path === "/portal"
              ? pathname === "/portal"
              : pathname.startsWith(item.path);
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                component={Link}
                href={item.path}
                selected={selected}
                onClick={() => setMobileOpen(false)}
                sx={{ borderRadius: 2 }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: 600 }} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
      <Divider />
      <List sx={{ px: 1 }}>
        <ListItem disablePadding>
          <ListItemButton onClick={() => void signOut()} sx={{ borderRadius: 2 }}>
            <ListItemIcon sx={{ minWidth: 40 }}>
              <LogoutIcon />
            </ListItemIcon>
            <ListItemText primary="退出登录" />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        minHeight: "calc(100vh - 64px)",
      }}
    >
      {/* Rendered always, toggled with CSS — branching on useMediaQuery made
          the server and client emit different markup, which broke hydration
          and left the whole portal non-interactive in some viewports. */}
      <AppBar
        position="sticky"
        color="default"
        elevation={1}
        sx={{ top: 0, display: { xs: "block", md: "none" } }}
      >
        <Toolbar>
          <IconButton edge="start" onClick={() => setMobileOpen(true)} aria-label="打开菜单">
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" fontWeight={800} color="secondary.main" sx={{ ml: 1 }}>
            {portalCopy.brand}
          </Typography>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": {
              width: DRAWER_WIDTH,
              boxSizing: "border-box",
              position: "static",
              height: "auto",
              minHeight: "100%",
              borderRight: `1px solid ${theme.palette.divider}`,
            },
          }}
        >
          {drawerContent}
        </Drawer>

        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": { width: DRAWER_WIDTH, boxSizing: "border-box" },
          }}
        >
          {drawerContent}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 4 }, maxWidth: "100%" }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          children
        )}
      </Box>
    </Box>
  );
}
