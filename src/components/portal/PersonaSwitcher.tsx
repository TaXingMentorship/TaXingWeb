"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import type { Persona } from "@/types/portal";
import { portalCopy } from "@/data/portalCopy";
import { usePortalSession } from "@/components/portal/PortalSessionProvider";

/**
 * Lets a user look at the portal through another identity they hold — and lets
 * an admin preview all four. The nav, the home tiles and every page's own
 * `is_admin` check follow automatically, because the session provider projects
 * `currentUser` through the selected persona.
 *
 * It changes what is *shown*, never what is *allowed* — RLS and
 * `requireApiRole()` both read the real profile. This control is the only
 * indication that a preview is active, so it stays visible in the sidebar
 * rather than collapsing into a menu.
 */
export default function PersonaSwitcher() {
  const { persona, availablePersonas, setPersona, realUser } =
    usePortalSession();
  const copy = portalCopy.persona;

  // One identity means nothing to switch between.
  if (!persona || availablePersonas.length <= 1) return null;

  const primaryLabel = (option: Persona) => {
    const holdsIt =
      (option === "admin" && realUser?.is_admin) ||
      (option === "volunteer" && realUser?.is_volunteer) ||
      option === realUser?.participant_role;
    return holdsIt ? `${copy.options[option]} · ${copy.primaryHint}` : copy.options[option];
  };

  return (
    <Box sx={{ px: 2.5, pb: 2 }}>
      <TextField
        select
        size="small"
        fullWidth
        label={copy.label}
        value={persona}
        onChange={(event) => setPersona(event.target.value as Persona)}
      >
        {availablePersonas.map((option) => (
          <MenuItem key={option} value={option}>
            <Typography variant="body2" component="span">
              {primaryLabel(option)}
            </Typography>
          </MenuItem>
        ))}
      </TextField>
    </Box>
  );
}
