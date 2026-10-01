import * as React from "react";
import Link from "@mui/material/Link";

// Bare http(s):// and www. links. Stops at whitespace and at the CJK / ASCII
// punctuation that follows a link in running Chinese text, so
// 「看 https://a.com。」 links `https://a.com`, not `https://a.com。`.
const URL_PATTERN =
  /(?:https?:\/\/|www\.)[^\s<>"'　-〿＀-￯，。！？、；：（）【】《》「」『』]+/gi;
const TRAILING_PUNCTUATION = /[.,;:!?)\]}]+$/;

type Segment = { text: string; href?: string };

export function splitLinks(text: string): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    const raw = match[0];
    const url = raw.replace(TRAILING_PUNCTUATION, "");
    // `www.` with nothing after the dot is not a link.
    if (!/^(?:https?:\/\/|www\.)\S+/i.test(url)) continue;

    if (start > cursor) segments.push({ text: text.slice(cursor, start) });
    segments.push({
      text: url,
      href: /^https?:\/\//i.test(url) ? url : `https://${url}`,
    });
    cursor = start + url.length;
  }

  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments;
}

/**
 * Renders user-written text with bare URLs turned into links. Only http(s) is
 * ever linked, and the text goes through React, never innerHTML. Line breaks
 * are preserved by the caller's `whiteSpace: pre-wrap`.
 */
export default function LinkifiedText({ text }: { text: string }) {
  return (
    <>
      {splitLinks(text).map((segment, index) =>
        segment.href ? (
          <Link
            key={index}
            href={segment.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {segment.text}
          </Link>
        ) : (
          <React.Fragment key={index}>{segment.text}</React.Fragment>
        ),
      )}
    </>
  );
}
