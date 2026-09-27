"use client";

import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Tooltip from "@mui/material/Tooltip";

interface SecretVisibilityToggleProps {
  visible: boolean;
  onToggle: () => void;
  name: string;
}

export default function SecretVisibilityToggle({
  visible,
  onToggle,
  name,
}: SecretVisibilityToggleProps) {
  const label = visible ? `隐藏${name}` : `显示${name}`;

  return (
    <InputAdornment position="end">
      <Tooltip title={label}>
        <IconButton
          aria-label={label}
          edge="end"
          onClick={onToggle}
          onMouseDown={(event) => event.preventDefault()}
        >
          {/* The icon shows the current state, not the action: a closed eye
              while the secret is masked, an open one while it is readable. */}
          {visible ? <VisibilityIcon /> : <VisibilityOffIcon />}
        </IconButton>
      </Tooltip>
    </InputAdornment>
  );
}
