"use client";

import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Tooltip from "@mui/material/Tooltip";
import CheckIcon from "@mui/icons-material/Check";
import type { BulletinColor } from "@/types/portal";
import { postColorOrder, postColors } from "@/data/portalCopy";

/**
 * Card background swatches. Colour is decoration only — the category chip
 * carries the meaning — so nothing is lost if a reader cannot tell these
 * apart.
 */
export default function ColorPicker({
  value,
  onChange,
}: {
  value: BulletinColor;
  onChange: (color: BulletinColor) => void;
}) {
  return (
    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
      {postColorOrder.map((color) => {
        const swatch = postColors[color];
        const selected = color === value;
        return (
          <Tooltip key={color} title={swatch.label}>
            <ButtonBase
              aria-label={swatch.label}
              aria-pressed={selected}
              onClick={() => onChange(color)}
              sx={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                bgcolor: swatch.bg,
                border: "2px solid",
                borderColor: selected ? "secondary.main" : swatch.border,
                color: "text.primary",
              }}
            >
              {selected && <CheckIcon sx={{ fontSize: 16 }} />}
            </ButtonBase>
          </Tooltip>
        );
      })}
    </Box>
  );
}
