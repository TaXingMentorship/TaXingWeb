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
 * Open the tab the printable page will appear in. It has to be opened here,
 * synchronously, from the click: avatars are fetched afterwards, and by then
 * the click's user activation is gone and a popup would be blocked. Returns
 * null when the browser blocks it. The tab shows a short note until the page is
 * written into it.
 */
export function openPrintTab(waitingText: string): Window | null {
  const tab = window.open("", "_blank");
  if (!tab) return null;
  tab.document.title = waitingText;
  tab.document.body.style.cssText = "font:16px system-ui,sans-serif;padding:24px;color:#555";
  tab.document.body.textContent = waitingText;
  return tab;
}

/**
 * Write the page into the tab, then open the print dialog on it. The person
 * sees the document first, and chooses 「另存为 PDF」 in the dialog; printing to
 * PDF embeds the fonts it used. This is a real page in a real tab rather than a
 * hidden frame: browsers print a tiny or hidden frame as a blank page.
 */
export async function writeAndPrint(tab: Window, html: string): Promise<void> {
  tab.document.open();
  tab.document.write(html);
  tab.document.close();
  // Avatars are data: URLs, but decoding is still asynchronous: print only once
  // they can be drawn, or they come out blank.
  await Promise.all(
    Array.from(tab.document.images).map((image) => image.decode().catch(() => undefined)),
  );
  tab.focus();
  tab.print();
}

/** Local calendar date as YYYY-MM-DD (not UTC: a late-night export is that day). */
export function localDateStamp(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
