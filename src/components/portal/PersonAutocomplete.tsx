"use client";

import * as React from "react";
import Autocomplete, { createFilterOptions } from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { Profile } from "@/types/portal";
import { portalCopy } from "@/data/portalCopy";

type Person = Pick<Profile, "id" | "full_name" | "email" | "wechat_number">;

const filter = createFilterOptions<Person>({
  stringify: (p) => [p.full_name, p.email, p.wechat_number].filter(Boolean).join(" "),
});

/**
 * A mentor / mentee picker you can type into. It matches on nickname, email
 * and 微信号, and shows the email under each name, because nicknames are not
 * unique (two members can share one) and the email is what tells them apart.
 */
export default function PersonAutocomplete({
  label,
  options,
  value,
  onChange,
  disabled,
  helperText,
}: {
  label: string;
  options: Person[];
  /** The selected person's id, or "" for none. */
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  helperText?: string;
}) {
  const copy = portalCopy.personPicker;
  const sorted = React.useMemo(
    () => [...options].sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? "", "zh")),
    [options],
  );
  const selected = sorted.find((p) => p.id === value) ?? null;

  return (
    <Autocomplete
      options={sorted}
      value={selected}
      onChange={(_, next) => onChange(next?.id ?? "")}
      getOptionLabel={(p) => p.full_name ?? p.email ?? ""}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      filterOptions={filter}
      disabled={disabled}
      autoHighlight
      noOptionsText={copy.noOptions}
      clearText={copy.clear}
      openText={copy.open}
      closeText={copy.close}
      fullWidth
      renderOption={(props, p) => {
        const { key, ...rest } = props;
        return (
          <Box component="li" key={key} {...rest}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" noWrap>
                {p.full_name}
              </Typography>
              {p.email && (
                <Typography variant="caption" color="text.secondary" noWrap display="block">
                  {p.email}
                </Typography>
              )}
            </Box>
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField {...params} label={label} helperText={helperText} placeholder={copy.placeholder} />
      )}
    />
  );
}
