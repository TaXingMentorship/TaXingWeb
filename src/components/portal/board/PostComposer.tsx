"use client";

import * as React from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import Alert from "@mui/material/Alert";
import EmojiEmotionsOutlinedIcon from "@mui/icons-material/EmojiEmotionsOutlined";
import type { BulletinBoard, BulletinCategory, BulletinColor } from "@/types/portal";
import { allCategories, categoryLabels, portalCopy } from "@/data/portalCopy";
import EmojiPicker from "./EmojiPicker";
import ColorPicker from "./ColorPicker";

const MAX_TITLE = 60;
const MAX_BODY = 2000;

export type ComposerDraft = {
  title: string | null;
  body: string;
  category: BulletinCategory;
  color: BulletinColor;
  isAnonymous: boolean;
};

export default function PostComposer({
  open,
  board,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  board: BulletinBoard;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (draft: ComposerDraft) => void;
}) {
  const categories = board.allowed_categories?.length
    ? board.allowed_categories
    : allCategories;

  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [category, setCategory] = React.useState<BulletinCategory>(categories[0]);
  const [color, setColor] = React.useState<BulletinColor>("default");
  const [anonymous, setAnonymous] = React.useState(false);
  const [emojiAnchor, setEmojiAnchor] = React.useState<null | HTMLElement>(null);
  const bodyRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setTitle("");
    setBody("");
    setCategory(categories[0]);
    setColor("default");
    setAnonymous(false);
    setEmojiAnchor(null);
    // `categories` is derived from the board and stable for a given board.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, board.id]);

  /** Inserts the emoji at the caret, or appends when the field is unfocused. */
  const insertEmoji = (emoji: string) => {
    const field = bodyRef.current;
    const start = field?.selectionStart ?? body.length;
    const end = field?.selectionEnd ?? body.length;
    const next = (body.slice(0, start) + emoji + body.slice(end)).slice(
      0,
      MAX_BODY,
    );

    setBody(next);
    setEmojiAnchor(null);

    if (field) {
      const caret = Math.min(start + emoji.length, MAX_BODY);
      requestAnimationFrame(() => {
        field.focus();
        field.setSelectionRange(caret, caret);
      });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{portalCopy.board.composeTitle}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {board.prompt && <Alert severity="info">{board.prompt}</Alert>}
          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            label={portalCopy.board.titleLabel}
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE))}
            helperText={`${title.length} / ${MAX_TITLE}`}
            fullWidth
            autoFocus
          />

          <Box>
            <TextField
              label={portalCopy.board.bodyLabel}
              placeholder={portalCopy.board.bodyPlaceholder}
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY))}
              helperText={`${body.length} / ${MAX_BODY}`}
              inputRef={bodyRef}
              multiline
              minRows={4}
              fullWidth
            />
            <Button
              size="small"
              startIcon={<EmojiEmotionsOutlinedIcon />}
              onClick={(e) => setEmojiAnchor(e.currentTarget)}
            >
              {portalCopy.board.emojiButton}
            </Button>
            <EmojiPicker
              anchorEl={emojiAnchor}
              onClose={() => setEmojiAnchor(null)}
              onSelect={insertEmoji}
            />
          </Box>

          {categories.length > 1 && (
            <TextField
              select
              label={portalCopy.board.categoryLabel}
              value={category}
              onChange={(e) => setCategory(e.target.value as BulletinCategory)}
              fullWidth
            >
              {categories.map((c) => (
                <MenuItem key={c} value={c}>
                  {categoryLabels[c]}
                </MenuItem>
              ))}
            </TextField>
          )}

          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {portalCopy.board.colorLabel}
            </Typography>
            <ColorPicker value={color} onChange={setColor} />
          </Box>

          {board.allow_anonymous && (
            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={anonymous}
                    onChange={(e) => setAnonymous(e.target.checked)}
                  />
                }
                label={portalCopy.board.anonymousLabel}
              />
              <Typography variant="caption" color="text.secondary" display="block">
                {portalCopy.board.anonymousHint}
              </Typography>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{portalCopy.board.cancel}</Button>
        <Button
          variant="contained"
          color="secondary"
          disabled={!body.trim() || pending}
          onClick={() =>
            onSubmit({
              title: title.trim() || null,
              body: body.trim(),
              category,
              color,
              isAnonymous: board.allow_anonymous && anonymous,
            })
          }
        >
          {portalCopy.board.submit}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
