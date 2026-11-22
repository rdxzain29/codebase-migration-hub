import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { collectShorts, decodeCursor, encodeCursor, parseShortsPage, type ChannelShort } from "@/lib/shorts";
import { parseChannelFeed } from "@/lib/youtube";

const CHANNEL_ID = "UCe0L3h7fLRLcc26Mwnah7TA";
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export type ShortsPage = { items: ChannelShort[]; next: string | null };

let firstPageCache: { at: number; page: ShortsPage } | null = null;

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return res.ok ? res : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Latest 15 Shorts from the channel's public Shorts playlist feed — used if the Shorts tab can't be read. */
async function shortsFromFeed(): Promise<ShortsPage> {
  const res = await fetchWithTimeout(
    `https://www.youtube.com/feeds/videos.xml?playlist_id=UUSH${CHANNEL_ID.slice(2)}`,
    { headers: { "user-agent": BROWSER_UA } },
    8_000,
  );
  if (!res) return { items: [], next: null };
  const videos = parseChannelFeed(await res.text());
  return { items: videos.map((v) => ({ id: v.id, title: v.title, views: v.views ? `${v.views.toLocaleString("en")} views` : null })), next: null };
}

/** One page of the channel's YouTube Shorts (newest first). Pass `cursor` from the previous page for more. */
export const getChannelShorts = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ cursor: z.string().max(6000).optional() }).parse(input ?? {}))
  .handler(async ({ data }): Promise<ShortsPage> => {
    if (!data.cursor) {
      if (firstPageCache && Date.now() - firstPageCache.at < 15 * 60 * 1000) return firstPageCache.page;
      const res = await fetchWithTimeout(
        `https://www.youtube.com/channel/${CHANNEL_ID}/shorts?hl=en&gl=US`,
        { headers: { "user-agent": BROWSER_UA, "accept-language": "en-US,en;q=0.9" } },
        10_000,
      );
      const parsed = res ? parseShortsPage(await res.text()) : null;
      if (!parsed || parsed.items.length === 0) return shortsFromFeed();
      const page: ShortsPage = {
        items: parsed.items,
        next: parsed.continuation ? encodeCursor(parsed.clientVersion, parsed.continuation) : null,
      };
      firstPageCache = { at: Date.now(), page };
      return page;
    }

    const cursor = decodeCursor(data.cursor);
    if (!cursor) return { items: [], next: null };
    const res = await fetchWithTimeout(
      "https://www.youtube.com/youtubei/v1/browse?prettyPrint=false",
      {
        method: "POST",
        headers: { "content-type": "application/json", "user-agent": BROWSER_UA },
        body: JSON.stringify({
          context: { client: { clientName: "WEB", clientVersion: cursor.clientVersion, hl: "en", gl: "US" } },
          continuation: cursor.token,
        }),
      },
      10_000,
    );
    if (!res) return { items: [], next: null };
    try {
      const found = collectShorts(await res.json());
      return {
        items: found.items,
        next: found.continuation ? encodeCursor(cursor.clientVersion, found.continuation) : null,
      };
    } catch {
      return { items: [], next: null };
    }
  });
