"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import AddIcon from "@mui/icons-material/Add";
import ForumIcon from "@mui/icons-material/Forum";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import type { BulletinBoard } from "@/types/portal";
import {
  countPostsByBoard,
  createBoard,
  getCohort,
  listBoards,
} from "@/lib/portal/store";
import { portalCopy } from "@/data/portalCopy";
import { usePortalSession } from "@/components/portal/PortalSessionProvider";

export default function BoardListPage() {
  const { currentUser } = usePortalSession();
  const queryClient = useQueryClient();
  const isAdmin = currentUser?.role === "admin";
  const cohortIds = currentUser?.cohort_ids ?? [];
  const [createOpen, setCreateOpen] = React.useState(false);

  const { data: boards, isLoading } = useQuery({
    queryKey: ["portal", "boards", cohortIds],
    queryFn: () => listBoards({ cohortIds }),
    enabled: Boolean(currentUser),
  });

  const { data: counts } = useQuery({
    queryKey: ["portal", "boardCounts", isAdmin],
    queryFn: () => countPostsByBoard(isAdmin),
  });

  return (
    <Box sx={{ maxWidth: 880 }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        gap={1}
        sx={{ mb: 1 }}
      >
        <Typography variant="h4" fontWeight={800}>
          {portalCopy.board.title}
        </Typography>
        {isAdmin && (
          <Button
            variant="contained"
            color="secondary"
            startIcon={<AddIcon />}
            onClick={() => setCreateOpen(true)}
          >
            {portalCopy.board.createButton}
          </Button>
        )}
      </Stack>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {portalCopy.board.listSubtitle}
      </Typography>

      {isLoading ? (
        <Typography color="text.secondary">加载中…</Typography>
      ) : boards && boards.length > 0 ? (
        <Grid container spacing={2}>
          {boards.map((board) => (
            <Grid key={board.id} size={{ xs: 12, sm: 6 }}>
              <Card sx={{ borderRadius: 3, height: "100%" }}>
                <CardActionArea
                  component={Link}
                  href={`/portal/board/${board.id}`}
                  sx={{ height: "100%" }}
                >
                  <CardContent>
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                      <ForumIcon color="secondary" sx={{ mt: 0.5 }} />
                      <Box sx={{ flexGrow: 1 }}>
                        <Stack
                          direction="row"
                          alignItems="center"
                          spacing={1}
                          flexWrap="wrap"
                          useFlexGap
                        >
                          <Typography variant="h6" fontWeight={700}>
                            {board.name}
                          </Typography>
                          {!board.is_open && (
                            <Chip size="small" label={portalCopy.board.closed} />
                          )}
                        </Stack>
                        {board.description && (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {board.description}
                          </Typography>
                        )}
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                          {counts?.[board.id] ?? 0} {portalCopy.board.postCount}
                        </Typography>
                      </Box>
                      <ChevronRightIcon color="action" />
                    </Stack>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Alert severity="info">{portalCopy.board.empty}</Alert>
      )}

      {isAdmin && (
        <CreateBoardDialog
          open={createOpen}
          cohortIds={cohortIds}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            queryClient.invalidateQueries({ queryKey: ["portal", "boards"] });
          }}
        />
      )}
    </Box>
  );
}

function CreateBoardDialog({
  open,
  cohortIds,
  onClose,
  onCreated,
}: {
  open: boolean;
  cohortIds: string[];
  onClose: () => void;
  onCreated: (board: BulletinBoard) => void;
}) {
  const [cohortId, setCohortId] = React.useState(cohortIds[0] ?? "");
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [isOpen, setIsOpen] = React.useState(true);

  React.useEffect(() => {
    if (open) {
      setCohortId(cohortIds[0] ?? "");
      setName("");
      setDescription("");
      setIsOpen(true);
    }
  }, [open, cohortIds]);

  const mutation = useMutation({
    mutationFn: () =>
      createBoard({
        cohort_id: cohortId,
        name: name.trim(),
        description: description.trim() || null,
        is_open: isOpen,
      }),
    onSuccess: onCreated,
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{portalCopy.board.createTitle}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {cohortIds.length > 1 && (
            <TextField
              select
              label="所属项目"
              value={cohortId}
              onChange={(e) => setCohortId(e.target.value)}
              fullWidth
            >
              {cohortIds.map((id) => (
                <CohortMenuItem key={id} id={id} />
              ))}
            </TextField>
          )}
          <TextField
            label={portalCopy.board.nameLabel}
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            autoFocus
          />
          <TextField
            label={portalCopy.board.descriptionLabel}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            minRows={2}
          />
          <FormControlLabel
            control={
              <Switch checked={isOpen} onChange={(e) => setIsOpen(e.target.checked)} />
            }
            label={portalCopy.board.openLabel}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button
          variant="contained"
          color="secondary"
          disabled={!name.trim() || !cohortId || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          创建
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function CohortMenuItem({ id }: { id: string }) {
  const { data: cohort } = useQuery({
    queryKey: ["portal", "cohort", id],
    queryFn: () => getCohort(id),
  });
  return <MenuItem value={id}>{cohort?.name ?? id}</MenuItem>;
}
