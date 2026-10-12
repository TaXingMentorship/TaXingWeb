const FALLBACK_PATH = "/portal";

/** Keep post-login navigation inside the member portal on this origin. */
export function safePortalNextPath(value: string | null, origin: string): string {
  if (!value?.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return FALLBACK_PATH;
  }

  try {
    const destination = new URL(value, origin);
    if (
      destination.origin !== origin ||
      (destination.pathname !== "/portal" &&
        !destination.pathname.startsWith("/portal/"))
    ) {
      return FALLBACK_PATH;
    }

    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return FALLBACK_PATH;
  }
}
