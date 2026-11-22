/** Parsing of the public YouTube channel "Shorts" tab (no API key needed). */
export type ChannelShort = { id: string; title: string; views: string | null };

type Found = { items: ChannelShort[]; continuation: string | null };

const ID = /^[A-Za-z0-9_-]{11}$/;

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}
function path(v: unknown, ...keys: string[]): unknown {
  let cur: unknown = v;
  for (const k of keys) cur = obj(cur)?.[k];
  return cur;
}
function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function fromLockup(v: Record<string, unknown>): ChannelShort | null {
  const id =
    str(path(v, "onTap", "innertubeCommand", "reelWatchEndpoint", "videoId")) ??
    str(v["entityId"])?.replace(/^shorts-shelf-item-/, "") ??
    null;
  if (!id || !ID.test(id)) return null;
  const a11y = str(v["accessibilityText"]);
  const title =
    str(path(v, "overlayMetadata", "primaryText", "content")) ??
    a11y?.replace(/,\s*[\d.,]+[KMB]?\s+views?\s*-\s*play Short$/i, "") ??
    "";
  return { id, title, views: str(path(v, "overlayMetadata", "secondaryText", "content")) };
}

function fromReelItem(v: Record<string, unknown>): ChannelShort | null {
  const id = str(v["videoId"]);
  if (!id || !ID.test(id)) return null;
  return {
    id,
    title: str(path(v, "headline", "simpleText")) ?? "",
    views: str(path(v, "viewCountText", "simpleText")),
  };
}

/** Collects every Short and the first "load more" token anywhere in a YouTube response. */
export function collectShorts(root: unknown): Found {
  const items: ChannelShort[] = [];
  const seen = new Set<string>();
  let continuation: string | null = null;
  const stack: unknown[] = [root];
  while (stack.length) {
    const cur = stack.pop();
    if (Array.isArray(cur)) {
      for (let i = cur.length - 1; i >= 0; i--) stack.push(cur[i]);
      continue;
    }
    const o = obj(cur);
    if (!o) continue;
    const lockup = obj(o["shortsLockupViewModel"]);
    const reel = obj(o["reelItemRenderer"]);
    const short = lockup ? fromLockup(lockup) : reel ? fromReelItem(reel) : null;
    if (short && !seen.has(short.id)) {
      seen.add(short.id);
      items.push(short);
    }
    const token = str(path(o["continuationItemRenderer"], "continuationEndpoint", "continuationCommand", "token"));
    if (token && !continuation) continuation = token;
    if (!lockup && !reel) {
      const values = Object.values(o);
      for (let i = values.length - 1; i >= 0; i--) stack.push(values[i]);
    }
  }
  return { items, continuation };
}

/** Reads ytInitialData and the web client version out of the Shorts tab HTML. */
export function parseShortsPage(html: string): (Found & { clientVersion: string }) | null {
  const marker = "var ytInitialData = ";
  const start = html.indexOf(marker);
  if (start < 0) return null;
  const end = html.indexOf(";</script>", start);
  if (end < 0) return null;
  try {
    const data: unknown = JSON.parse(html.slice(start + marker.length, end));
    const clientVersion = /"INNERTUBE_CLIENT_VERSION":"([^"]+)"/.exec(html)?.[1] ?? "2.20250101.00.00";
    return { ...collectShorts(data), clientVersion };
  } catch {
    return null;
  }
}

/** A "load more" cursor carries the client version alongside YouTube's token. */
export function encodeCursor(clientVersion: string, token: string) {
  return `${clientVersion}~${token}`;
}
export function decodeCursor(cursor: string): { clientVersion: string; token: string } | null {
  const i = cursor.indexOf("~");
  if (i < 1) return null;
  const clientVersion = cursor.slice(0, i);
  const token = cursor.slice(i + 1);
  return /^[\d.]+$/.test(clientVersion) && /^[A-Za-z0-9_%=-]+$/.test(token) ? { clientVersion, token } : null;
}
