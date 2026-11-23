import { describe, expect, it } from "vitest";

import { nextEpisodeNumber, uniqueSlug } from "@/lib/admin-catalog";
import { buildCatalog, EMPTY_OVERRIDES } from "@/lib/catalog";
import { embedUrlFor, isPlayableId, isTeraboxLink, parseVideoLink, titleFromFileName } from "@/lib/video";

describe("owner video links", () => {
  it("reads a Google Drive video link and plays it inside the site with Drive's player", () => {
    const v = parseVideoLink("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view?usp=sharing");
    expect(v?.source).toBe("gdrive");
    expect(v?.id).toBe("gd-1AbCdEfGhIjKlMnOpQrStUvWxYz012345");
    expect(embedUrlFor("gd-1AbCdEfGhIjKlMnOpQrStUvWxYz012345")).toBe("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/preview");
  });

  it("reads Drive open?id= links", () => {
    expect(parseVideoLink("https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUvWxYz012345")?.id).toBe("gd-1AbCdEfGhIjKlMnOpQrStUvWxYz012345");
  });

  it("no longer accepts TeraBox links for new parts", () => {
    expect(parseVideoLink("https://1024terabox.com/s/1EVpU917RtvEHp01iMEyxaA")).toBeNull();
    expect(isTeraboxLink("https://1024terabox.com/s/1EVpU917RtvEHp01iMEyxaA")).toBe(true);
  });

  it("never plays an old TeraBox part inside the site", () => {
    expect(isPlayableId("tb-EVpU917RtvEHp01iMEyxaA")).toBe(false);
    expect(isPlayableId("gd-1AbCdEfGhIjKlMnOpQrStUvWxYz012345")).toBe(true);
    expect(isPlayableId("hKBrXDgq6HM")).toBe(true);
  });

  it("still reads YouTube links", () => {
    expect(parseVideoLink("https://youtu.be/hKBrXDgq6HM")).toEqual({ source: "youtube", id: "hKBrXDgq6HM", shareUrl: null });
  });

  it("rejects links from other sites", () => {
    expect(parseVideoLink("https://example.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345")).toBeNull();
  });

  it("turns a video file name into a title", () => {
    expect(titleFromFileName("Justaju Thi khas _ Episode 1 _ Zeenia Sharjeel _ Complete Text + Audio.mp4"))
      .toBe("Justaju Thi khas | Episode 1 | Zeenia Sharjeel | Complete Text + Audio");
  });
});

describe("adding parts and series", () => {
  it("suggests the next episode after the highest one", () => {
    expect(nextEpisodeNumber({ eps: [{ id: "a", t: "", ep: 1, s: null, d: 0, v: 0 }, { id: "b", t: "", ep: 7, s: null, d: 0, v: 0 }] })).toBe(8);
    expect(nextEpisodeNumber({ eps: [] })).toBe(1);
  });

  it("gives a new series a slug that does not clash", () => {
    expect(uniqueSlug("Man Yaram", (s) => s === "man-yaram")).toBe("man-yaram-2");
  });

  it("shows a new series with a Google Drive first episode, Drive's picture and a new category", () => {
    const view = buildCatalog({
      ...EMPTY_OVERRIDES,
      version: "t1",
      categories: [{ slug: "revenge", name: "Revenge Based" }],
      novels: [{ slug: "nayi-kahani-test", name: "Nayi Kahani", urdu: null, subtitle: null, author: "Zeenia Sharjeel", cats: ["revenge"], format: "series", playlist: null, hidden: false }],
      videos: [{ video_id: "gd-1AbCdEfGhIjKlMnOpQrStUvWxYz012345", novel_slug: "nayi-kahani-test", title: "Episode 1", ep: 1, season: null, duration_sec: 0, views: 0, hidden: false, published_at: null, source: "gdrive", share_url: null, thumb_url: null }],
    });
    const novel = view.novels.find((n) => n.slug === "nayi-kahani-test");
    expect(novel?.eps.map((e) => e.id)).toEqual(["gd-1AbCdEfGhIjKlMnOpQrStUvWxYz012345"]);
    expect(novel?.eps[0]?.img).toBe("https://drive.google.com/thumbnail?id=1AbCdEfGhIjKlMnOpQrStUvWxYz012345&sz=w640");
    expect(view.categories.find((c) => c.slug === "revenge")).toEqual({ slug: "revenge", name: "Revenge Based", count: 1 });
  });

  it("adds a new part to an existing novel", () => {
    const view = buildCatalog({
      ...EMPTY_OVERRIDES,
      version: "t2",
      videos: [{ video_id: "AAAAAAAAAAA", novel_slug: "man-yaram", title: "Mann Yaram | Episode 19", ep: 19, season: null, duration_sec: 600, views: 0, hidden: false, published_at: null }],
    });
    const eps = view.novels.find((n) => n.slug === "man-yaram")?.eps ?? [];
    expect(eps).toHaveLength(19);
    expect(eps[eps.length - 1]?.id).toBe("AAAAAAAAAAA");
  });
});
