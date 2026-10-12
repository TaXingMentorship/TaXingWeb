"use client";

import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import type { SxProps, Theme } from "@mui/material/styles";
import { portalCopy } from "@/data/portalCopy";
import { useFavorites } from "@/components/portal/useFavorites";

/** The heart that bookmarks a member. Renders nothing for the viewer's own card. */
export default function FavoriteButton({
  profileId,
  sx,
}: {
  profileId: string;
  sx?: SxProps<Theme>;
}) {
  const { isFavorite, setFavorite, canFavorite } = useFavorites();
  if (!canFavorite(profileId)) return null;
  const active = isFavorite(profileId);
  const label = active ? portalCopy.favorites.remove : portalCopy.favorites.add;
  return (
    <Tooltip title={label}>
      <IconButton
        size="small"
        aria-label={label}
        aria-pressed={active}
        color={active ? "error" : "default"}
        onClick={(event) => {
          event.stopPropagation();
          setFavorite(profileId, !active);
        }}
        sx={sx}
      >
        {active ? <FavoriteIcon fontSize="small" /> : <FavoriteBorderIcon fontSize="small" />}
      </IconButton>
    </Tooltip>
  );
}
