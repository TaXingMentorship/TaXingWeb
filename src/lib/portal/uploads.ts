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
export const BULLETIN_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const BULLETIN_MAX_IMAGES = 4;
const IMMUTABLE_CACHE_SECONDS = "31536000";

type ImageOptimization = {
  maxDimension: number;
  targetBytes: number;
  square: boolean;
};

const AVATAR_OPTIMIZATION: ImageOptimization = {
  maxDimension: 256,
  targetBytes: 200 * 1024,
  square: true,
};
const BULLETIN_OPTIMIZATION: ImageOptimization = {
  maxDimension: 1200,
  targetBytes: 500 * 1024,
  square: false,
};

export function validateImageFile(file: File, maxBytes: number): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
    return "仅支持 JPEG、PNG 或 WebP 图片。";
  }
  if (file.size > maxBytes) {
    return `图片不能超过 ${maxBytes / 1024 / 1024} MB。`;
  }
  return null;
}

function canvasToWebp(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("图片压缩失败，请换一张图片后重试。"));
          return;
        }
        resolve(blob);
      },
      "image/webp",
      quality,
    );
  });
}

async function optimizeImage(
  file: File,
  options: ImageOptimization,
): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("无法读取这张图片，请重新导出为 JPEG、PNG 或 WebP 后重试。");
  }

  try {
    const sourceSize = options.square
      ? Math.min(bitmap.width, bitmap.height)
      : null;
    const sourceX = sourceSize === null ? 0 : (bitmap.width - sourceSize) / 2;
    const sourceY = sourceSize === null ? 0 : (bitmap.height - sourceSize) / 2;
    const sourceWidth = sourceSize ?? bitmap.width;
    const sourceHeight = sourceSize ?? bitmap.height;
    const initialScale = Math.min(
      1,
      options.maxDimension / Math.max(sourceWidth, sourceHeight),
    );

    let width = Math.max(1, Math.round(sourceWidth * initialScale));
    let height = Math.max(1, Math.round(sourceHeight * initialScale));
    let lastBlob: Blob | null = null;

    for (const quality of [0.82, 0.72, 0.62, 0.55, 0.48]) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("浏览器无法处理图片，请换一个浏览器后重试。");
      context.drawImage(
        bitmap,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        width,
        height,
      );
      lastBlob = await canvasToWebp(canvas, quality);
      if (lastBlob.size <= options.targetBytes) return lastBlob;
      if (!options.square && Math.max(width, height) > 480) {
        width = Math.max(1, Math.round(width * 0.8));
        height = Math.max(1, Math.round(height * 0.8));
      }
    }

    if (!lastBlob || lastBlob.size > options.targetBytes) {
      throw new Error("图片压缩后仍然过大，请裁剪图片后重试。");
    }
    return lastBlob;
  } finally {
    bitmap.close();
  }
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const validationError = validateImageFile(file, AVATAR_MAX_BYTES);
  if (validationError) throw new Error(validationError);

  const supabase = createClient();
  const optimized = await optimizeImage(file, AVATAR_OPTIMIZATION);
  const path = `${userId}/avatar-${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage.from("avatars").upload(path, optimized, {
    contentType: optimized.type,
    cacheControl: IMMUTABLE_CACHE_SECONDS,
  });
  if (error) throw new Error(`头像上传失败：${error.message}`);

  return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}

export async function removeReplacedAvatar(publicUrl: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(publicUrl);
  } catch {
    return;
  }
  const marker = "/storage/v1/object/public/avatars/";
  const markerIndex = url.pathname.indexOf(marker);
  if (markerIndex === -1) return;

  const path = decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
  if (!path) return;
  const { error } = await createClient().storage.from("avatars").remove([path]);
  if (error) throw new Error(`旧头像清理失败：${error.message}`);
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
      cacheControl: IMMUTABLE_CACHE_SECONDS,
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

export async function uploadBulletinImage(userId: string, file: File): Promise<string> {
  const validationError = validateImageFile(file, BULLETIN_IMAGE_MAX_BYTES);
  if (validationError) throw new Error(validationError);

  const optimized = await optimizeImage(file, BULLETIN_OPTIMIZATION);
  const path = `${userId}/${crypto.randomUUID()}.webp`;
  const { error } = await createClient()
    .storage.from("bulletin")
    .upload(path, optimized, {
      contentType: optimized.type,
      cacheControl: IMMUTABLE_CACHE_SECONDS,
    });
  if (error) throw new Error(`图片上传失败：${error.message}`);
  return path;
}

export async function getBulletinImageSignedUrl(path: string): Promise<string> {
  const { data, error } = await createClient()
    .storage.from("bulletin")
    .createSignedUrl(path, 60 * 60);
  if (error) throw new Error(`图片读取失败：${error.message}`);
  return data.signedUrl;
}
