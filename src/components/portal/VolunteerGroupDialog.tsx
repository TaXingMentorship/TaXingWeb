"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormHelperText from "@mui/material/FormHelperText";
import Box from "@mui/material/Box";
import type { VolunteerGroup } from "@/types/portal";
import { createVolunteerGroup, updateVolunteerGroup } from "@/lib/portal/store";
import { portalCopy } from "@/data/portalCopy";

/** Shared by create and edit — `group` null means create. */
export default function VolunteerGroupDialog({
  open,
  group,
  nextSortOrder,
  onClose,
  onSaved,
}: {
  open: boolean;
  group: VolunteerGroup | null;
  /** Where a newly created group lands, so it appends instead of tying for 0. */
  nextSortOrder: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const copy = portalCopy.adminVolunteers;

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [sortOrder, setSortOrder] = React.useState("0");
  const [includesLeads, setIncludesLeads] = React.useState(false);
  const [validationError, setValidationError] = React.useState<string | null>(
    null,
  );

  React.useEffect(() => {
    if (!open) return;
    setName(group?.name ?? "");
    setDescription(group?.description ?? "");
    setSortOrder(String(group?.sort_order ?? nextSortOrder));
    setIncludesLeads(group?.includes_leads ?? false);
    setValidationError(null);
  }, [open, group, nextSortOrder]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        sort_order: Number(sortOrder) || 0,
        includes_leads: includesLeads,
      };
      return group
        ? updateVolunteerGroup(group.id, payload)
        : createVolunteerGroup(payload);
    },
    onSuccess: onSaved,
  });

  const submit = () => {
    if (!name.trim()) {
      setValidationError(copy.groupNameRequired);
      return;
    }
    setValidationError(null);
    mutation.mutate();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        {group ? copy.editGroupTitle : copy.createGroupTitle}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {validationError ? (
            <Alert severity="error">{validationError}</Alert>
          ) : null}
          {mutation.isError ? (
            <Alert severity="error">{(mutation.error as Error).message}</Alert>
          ) : null}

          <TextField
            label={copy.groupNameLabel}
            value={name}
            onChange={(event) => setName(event.target.value)}
            fullWidth
            required
            autoFocus
          />
          <TextField
            label={copy.groupDescriptionLabel}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            fullWidth
            multiline
            minRows={2}
          />
          <TextField
            label={copy.groupSortLabel}
            type="number"
            slotProps={{ htmlInput: { inputMode: "numeric", min: 0, max: 9999 } }}
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
            fullWidth
          />
          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={includesLeads}
                  onChange={(event) => setIncludesLeads(event.target.checked)}
                />
              }
              label={copy.includesLeadsLabel}
            />
            <FormHelperText>{copy.includesLeadsHelp}</FormHelperText>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{portalCopy.volunteers.cancel}</Button>
        <Button
          variant="contained"
          color="secondary"
          disabled={mutation.isPending}
          onClick={submit}
        >
          {portalCopy.volunteers.save}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
