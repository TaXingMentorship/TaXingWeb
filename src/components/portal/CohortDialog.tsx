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
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import Alert from "@mui/material/Alert";
import type { Cohort } from "@/types/portal";
import { createCohort, updateCohort } from "@/lib/portal/store";
import { portalCopy } from "@/data/portalCopy";

/** Shared by create and edit — `cohort` null means create. */
export default function CohortDialog({
  open,
  cohort,
  onClose,
  onSaved,
}: {
  open: boolean;
  cohort: Cohort | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const copy = portalCopy.cohorts;

  const [name, setName] = React.useState("");
  const [startsAt, setStartsAt] = React.useState("");
  const [endsAt, setEndsAt] = React.useState("");
  const [bulletinOpen, setBulletinOpen] = React.useState(true);
  const [validationError, setValidationError] = React.useState<string | null>(
    null,
  );

  React.useEffect(() => {
    if (!open) return;
    setName(cohort?.name ?? "");
    setStartsAt(cohort?.starts_at ?? "");
    setEndsAt(cohort?.ends_at ?? "");
    setBulletinOpen(cohort?.bulletin_open ?? true);
    setValidationError(null);
  }, [open, cohort]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: name.trim(),
        starts_at: startsAt || null,
        ends_at: endsAt || null,
        bulletin_open: bulletinOpen,
      };
      return cohort ? updateCohort(cohort.id, payload) : createCohort(payload);
    },
    onSuccess: onSaved,
  });

  const submit = () => {
    if (!name.trim()) {
      setValidationError(copy.nameRequired);
      return;
    }
    if (startsAt && endsAt && endsAt < startsAt) {
      setValidationError(copy.endBeforeStart);
      return;
    }
    setValidationError(null);
    mutation.mutate();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{cohort ? copy.editTitle : copy.createTitle}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {validationError && <Alert severity="error">{validationError}</Alert>}
          {mutation.isError && (
            <Alert severity="error">{(mutation.error as Error).message}</Alert>
          )}

          <TextField
            label={copy.nameLabel}
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            autoFocus
          />
          <TextField
            label={copy.startsAtLabel}
            type="date"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            fullWidth
          />
          <TextField
            label={copy.endsAtLabel}
            type="date"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            fullWidth
          />
          <FormControlLabel
            control={
              <Switch
                checked={bulletinOpen}
                onChange={(e) => setBulletinOpen(e.target.checked)}
              />
            }
            label={copy.bulletinOpenLabel}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{copy.cancel}</Button>
        <Button
          variant="contained"
          color="secondary"
          disabled={mutation.isPending}
          onClick={submit}
        >
          {copy.save}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
