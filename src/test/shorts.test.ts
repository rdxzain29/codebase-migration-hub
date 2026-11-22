import { describe, expect, it } from "vitest";
import { collectShorts, decodeCursor, encodeCursor, parseShortsPage } from "@/lib/shorts";

const lockup = (id: string, title: string) => ({
  richItemRenderer: {
    content: {
      shortsLockupViewModel: {
        entityId: `shorts-shelf-item-${id}`,
        accessibilityText: `${title}, 131 views - play Short`,
        onTap: { innertubeCommand: { reelWatchEndpoint: { videoId: id } } },
        overlayMetadata: { primaryText: { content: title }, secondaryText: { content: "131 views" } },
      },
    },
  },
});

describe("channel Shorts for the Reels feed", () => {
  it("reads every Short and the load-more token from the Shorts tab", () => {
    const data = {
      contents: [lockup("d2QcRL7atns", "First love yourself"), lockup("abcdefghijk", "Second"), lockup("d2QcRL7atns", "dup")],
      more: { continuationItemRenderer: { continuationEndpoint: { continuationCommand: { token: "TOKEN123" } } } },
    };
    const html = `<script>var ytInitialData = ${JSON.stringify(data)};</script><script>"INNERTUBE_CLIENT_VERSION":"2.20261119.07.00"</script>`;
    const page = parseShortsPage(html);
    expect(page?.items.map((s) => s.id)).toEqual(["d2QcRL7atns", "abcdefghijk"]);
    expect(page?.items[0]?.title).toBe("First love yourself");
    expect(page?.continuation).toBe("TOKEN123");
    expect(page?.clientVersion).toBe("2.20261119.07.00");
  });

  it("stops paging when YouTube returns no more token", () => {
    expect(collectShorts({ items: [lockup("abcdefghijk", "x")] }).continuation).toBeNull();
  });

  it("keeps the load-more cursor intact and rejects tampered ones", () => {
    expect(decodeCursor(encodeCursor("2.20261119.07.00", "4qmF_s-g%3D"))).toEqual({ clientVersion: "2.20261119.07.00", token: "4qmF_s-g%3D" });
    expect(decodeCursor("bad")).toBeNull();
    expect(decodeCursor("2.1~<script>")).toBeNull();
  });
});
