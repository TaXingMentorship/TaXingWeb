"use client";

import { createClient } from "@/lib/supabase/client";

export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const IMAGE_ACCEPT = ACCEPTED_IMAGE_TYPES.join(",");
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const PARTICIPATION_MAX_BYTES = 5 * 1024 * 1024;

export function validateImageFile(file: File, maxBytes: number): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
    return "仅支持 JPEG、PNG 或 WebP 图片。";
  }
  if (file.size > maxBytes) {
    return `图片不能超过 ${maxBytes / 1024 / 1024} MB。`;
  }
  return null;
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const validationError = validateImageFile(file, AVATAR_MAX_BYTES);
  if (validationError) throw new Error(validationError);

  const supabase = createClient();
  const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const path = `${userId}/avatar-${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, {
    contentType: file.type,
    cacheControl: "3600",
  });
  if (error) throw new Error(`头像上传失败：${error.message}`);

  return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}

export async function uploadParticipationScreenshot(
  userId: string,
  file: File,
): Promise<string> {
  const validationError = validateImageFile(file, PARTICIPATION_MAX_BYTES);
  if (validationError) throw new Error(validationError);

  const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await createClient()
    .storage.from("participation")
    .upload(path, file, {
      contentType: file.type,
      cacheControl: "3600",
    });
  if (error) throw new Error(`截图上传失败：${error.message}`);
  return path;
}

export async function getParticipationSignedUrl(path: string): Promise<string> {
  const { data, error } = await createClient()
    .storage.from("participation")
    .createSignedUrl(path, 60 * 60);
  if (error) throw new Error(`截图读取失败：${error.message}`);
  return data.signedUrl;
}

export async function removeParticipationScreenshot(path: string): Promise<void> {
  const { error } = await createClient()
    .storage.from("participation")
    .remove([path]);
  if (error) throw new Error(`截图删除失败：${error.message}`);
}
