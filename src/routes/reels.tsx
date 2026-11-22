import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, Clapperboard, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ReelSlide } from "@/components/reels/ReelSlide";
import { manualReelsQuery, manualToFeed, type FeedReel } from "@/lib/reels";
import { getChannelShorts } from "@/lib/reels.functions";

export const Route = createFileRoute("/reels")({
  head: () => ({
    meta: [
      { title: "Watch Reels — Novels Forever" },
      { name: "description", content: "Swipe through every Novels Forever YouTube Short — quick moments from Urdu audio novels, one after another." },
      { property: "og:title", content: "Watch Reels — Novels Forever" },
      { property: "og:description", content: "Every Novels Forever Short in one swipeable feed." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReelsPage,
});

function ReelsPage() {
  const fetchShorts = useServerFn(getChannelShorts);
  const manual = useQuery(manualReelsQuery("public"));
  const shorts = useInfiniteQuery({
    queryKey: ["reels", "channel-shorts"],
    queryFn: ({ pageParam }) => fetchShorts({ data: pageParam ? { cursor: pageParam } : {} }),
    initialPageParam: "" as string,
    getNextPageParam: (last) => last.next ?? undefined,
    staleTime: 15 * 60 * 1000,
  });

  const reels = useMemo<FeedReel[]>(() => {
    const own = manualToFeed(manual.data ?? []);
    const seen = new Set(own.flatMap((r) => (r.kind === "youtube" ? [r.videoId] : [])));
    const channel: FeedReel[] = [];
    for (const page of shorts.data?.pages ?? []) {
      for (const s of page.items) {
        if (seen.has(s.id)) continue;
        seen.add(s.id);
        channel.push({ key: `yt-${s.id}`, kind: "youtube", videoId: s.id, title: s.title, views: s.views });
      }
    }
    return [...own, ...channel];
  }, [manual.data, shorts.data]);

  const feed = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(true);

  // The slide that fills most of the screen is the one that plays.
  useEffect(() => {
    const root = feed.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset["index"]));
        }
      },
      { root, threshold: 0.6 },
    );
    root.querySelectorAll("[data-index]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [reels.length]);

  // Load the next batch of Shorts before the reader reaches the end.
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = shorts;
  useEffect(() => {
    if (reels.length && active >= reels.length - 5 && hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [active, reels.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const go = useCallback((delta: number) => {
    const root = feed.current;
    if (!root) return;
    root.scrollBy({ top: delta * root.clientHeight, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "PageDown") { e.preventDefault(); go(1); }
      if (e.key === "ArrowUp" || e.key === "PageUp") { e.preventDefault(); go(-1); }
      if (e.key.toLowerCase() === "m") setMuted((m) => !m);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  // Wait for the owner's reels too, so they stay first and the feed never jumps.
  const loading = manual.isLoading || (shorts.isLoading && reels.length === 0);

  return (
    <div className="fixed inset-0 z-50 bg-reel text-reel-foreground">
      <div className="pt-safe absolute inset-x-0 top-0 z-10 flex items-center justify-between px-3 py-3">
        <Button asChild variant="reel" size="icon" className="h-11 w-11">
          <Link to="/" aria-label="Back to the library"><ArrowLeft className="!size-5" /></Link>
        </Button>
        <p className="flex items-center gap-2 font-display text-2xl font-semibold">
          <Clapperboard className="h-5 w-5 text-primary" /> Reels
        </p>
        <span className="w-11 text-right text-xs opacity-70">{reels.length ? `${active + 1}/${reels.length}${hasNextPage ? "+" : ""}` : ""}</span>
      </div>

      {loading ? (
        <div className="flex h-full flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm opacity-75">Loading reels…</p>
        </div>
      ) : reels.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="opacity-80">Reels could not be loaded right now.</p>
          <Button variant="gold" onClick={() => void shorts.refetch()}>Try again</Button>
        </div>
      ) : (
        <div ref={feed} className="reel-feed">
          {reels.map((reel, i) => (
            <section key={reel.key} data-index={i} className="reel-slide flex items-center justify-center sm:py-4" aria-label={reel.title || `Reel ${i + 1}`}>
              {Math.abs(i - active) <= 2 ? (
                <ReelSlide reel={reel} active={i === active} muted={muted} onToggleSound={() => setMuted((m) => !m)} />
              ) : (
                <div className="aspect-[9/16] h-full max-w-full bg-reel" />
              )}
            </section>
          ))}
          {isFetchingNextPage && (
            <div className="flex h-24 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          )}
        </div>
      )}

      <div className="absolute right-6 top-1/2 hidden -translate-y-1/2 flex-col gap-3 lg:flex">
        <Button variant="reel" size="icon" className="h-12 w-12" aria-label="Previous reel" onClick={() => go(-1)} disabled={active === 0}>
          <ChevronUp className="!size-6" />
        </Button>
        <Button variant="reel" size="icon" className="h-12 w-12" aria-label="Next reel" onClick={() => go(1)}>
          <ChevronDown className="!size-6" />
        </Button>
      </div>
    </div>
  );
}
