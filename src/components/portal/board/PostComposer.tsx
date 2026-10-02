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
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import CloseIcon from "@mui/icons-material/Close";
import IconButton from "@mui/material/IconButton";
import type { BulletinBoard, BulletinCategory, BulletinColor } from "@/types/portal";
import { allCategories, categoryLabels, portalCopy } from "@/data/portalCopy";
import {
  BULLETIN_IMAGE_MAX_BYTES,
  BULLETIN_MAX_IMAGES,
  validateImageFile,
} from "@/lib/portal/uploads";
import EmojiPicker from "./EmojiPicker";
import ColorPicker from "./ColorPicker";
import LinkifiedText from "./LinkifiedText";

const MAX_TITLE = 60;
const MAX_BODY = 2000;

export type ComposerDraft = {
  title: string | null;
  body: string;
  category: BulletinCategory;
  color: BulletinColor;
  isAnonymous: boolean;
  imageFiles: File[];
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
  const [imageFiles, setImageFiles] = React.useState<File[]>([]);
  const [imageError, setImageError] = React.useState<string | null>(null);
  const bodyRef = React.useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // One object URL per selected file, kept in the same order — revoked
  // whenever the selection changes so the browser doesn't hold onto memory
  // for images that were removed or never got submitted.
  const imagePreviews = React.useMemo(
    () => imageFiles.map((file) => URL.createObjectURL(file)),
    [imageFiles],
  );
  React.useEffect(() => {
    return () => imagePreviews.forEach((url) => URL.revokeObjectURL(url));
  }, [imagePreviews]);

  React.useEffect(() => {
    if (!open) return;
    setTitle("");
    setBody("");
    setCategory(categories[0]);
    setColor("default");
    setAnonymous(false);
    setEmojiAnchor(null);
    setImageFiles([]);
    setImageError(null);
    // `categories` is derived from the board and stable for a given board.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, board.id]);

  const addImages = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setImageError(null);

    setImageFiles((current) => {
      const next = [...current];
      for (const file of Array.from(files)) {
        if (next.length >= BULLETIN_MAX_IMAGES) {
          setImageError(portalCopy.board.imageLimitReached);
          break;
        }
        const validationError = validateImageFile(file, BULLETIN_IMAGE_MAX_BYTES);
        if (validationError) {
          setImageError(validationError);
          continue;
        }
        next.push(file);
      }
      return next;
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    setImageFiles((current) => current.filter((_, i) => i !== index));
    setImageError(null);
  };

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
          {board.prompt && (
            <Alert severity="info" sx={{ wordBreak: "break-word" }}>
              <LinkifiedText text={board.prompt} />
            </Alert>
          )}
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

          <Box>
            <Button
              size="small"
              startIcon={<AddPhotoAlternateOutlinedIcon />}
              disabled={imageFiles.length >= BULLETIN_MAX_IMAGES}
              onClick={() => fileInputRef.current?.click()}
            >
              {portalCopy.board.addImageButton}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              hidden
              onChange={(e) => addImages(e.target.files)}
            />
            {imageError && (
              <Typography variant="caption" color="error" display="block">
                {imageError}
              </Typography>
            )}
            {imagePreviews.length > 0 && (
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                {imagePreviews.map((url, index) => (
                  <Box
                    key={url}
                    sx={{
                      position: "relative",
                      width: 72,
                      height: 72,
                      borderRadius: 1.5,
                      overflow: "hidden",
                      border: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview, not a remote/optimizable image */}
                    <img
                      src={url}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                    <IconButton
                      size="small"
                      aria-label={portalCopy.board.removeImage}
                      onClick={() => removeImage(index)}
                      sx={{
                        position: "absolute",
                        top: 2,
                        right: 2,
                        bgcolor: "rgba(0,0,0,0.5)",
                        color: "common.white",
                        p: 0.25,
                        "&:hover": { bgcolor: "rgba(0,0,0,0.7)" },
                      }}
                    >
                      <CloseIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Box>
                ))}
              </Stack>
            )}
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
            <Typography
              variant="caption"
              color="text.secondary"
              fontWeight={600}
              display="block"
              sx={{ mb: 1 }}
            >
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
                slotProps={{ typography: { variant: "body2" } }}
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
              imageFiles,
            })
          }
        >
          {portalCopy.board.submit}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
