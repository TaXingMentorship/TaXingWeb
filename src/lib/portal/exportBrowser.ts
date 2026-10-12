// Browser-only half of 目录页「导出导师信息」: fetching avatars into the file,
// saving a file, and printing the page to PDF. The pure half is exportMentors.ts.

const AVATAR_SIZE = 160;
const AVATAR_TIMEOUT_MS = 8000;
const AVATAR_CONCURRENCY = 6;

/**
 * An avatar as a small square JPEG data: URL, or null. The stored `avatar_url`
 * is a remote address that would render blank offline, so it has to travel
 * inside the file. Any failure (network, CORS, not an image, a format the
 * browser cannot decode) is null, never a throw: one bad avatar must not stop
 * the export, it just becomes an initial.
 */
export async function avatarToDataUrl(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AVATAR_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, credentials: "omit" });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) return null;
    const bitmap = await createImageBitmap(blob);
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const context = canvas.getContext("2d");
    if (!context) return null;
    // JPEG has no transparency: paint white first so a transparent PNG is not black.
    context.fillStyle = "#fff";
    context.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
    context.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      AVATAR_SIZE,
      AVATAR_SIZE,
    );
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.82);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Avatars for many people, a few at a time. Keyed by id; missing → null. */
export async function loadAvatars(
  people: { id: string; avatar_url: string | null }[],
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  const queue = people.filter((p) => p.avatar_url);
  const worker = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      result.set(next.id, await avatarToDataUrl(next.avatar_url!));
    }
  };
  await Promise.all(Array.from({ length: Math.min(AVATAR_CONCURRENCY, queue.length) }, worker));
  return result;
}

export function downloadTextFile(name: string, content: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Open the browser's print dialog on a document, from a hidden frame. A frame
 * rather than a new window: avatars are fetched first, so by the time we print
 * the click's user activation is gone and a popup would be blocked. The person
 * chooses 「另存为 PDF」 there; printing to PDF embeds the fonts it used.
 */
export function printHtml(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    Object.assign(frame.style, {
      position: "fixed",
      right: "0",
      bottom: "0",
      width: "1px",
      height: "1px",
      border: "0",
      opacity: "0",
      pointerEvents: "none",
    });
    const cleanup = () => frame.remove();
    frame.onload = () => {
      const target = frame.contentWindow;
      if (!target) {
        cleanup();
        reject(new Error("no print window"));
        return;
      }
      target.addEventListener("afterprint", cleanup);
      // Some browsers never fire afterprint for a frame; do not leak it.
      setTimeout(cleanup, 10 * 60 * 1000);
      target.focus();
      target.print();
      resolve();
    };
    document.body.appendChild(frame);
    frame.srcdoc = html;
  });
}

/** Local calendar date as YYYY-MM-DD (not UTC: a late-night export is that day). */
export function localDateStamp(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
