import { useEffect, useRef, useState } from "react";
import { ExternalLink, Play, Share2, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { FeedReel } from "@/lib/reels";

const EMBED_ORIGIN = "https://www.youtube-nocookie.com";

function YoutubeReel({ id, active, muted }: { id: string; active: boolean; muted: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [cover, setCover] = useState(`https://i.ytimg.com/vi/${id}/oar2.jpg`);
  // Sound changes go to the playing video without reloading it.
  useEffect(() => {
    frame.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func: muted ? "mute" : "unMute", args: [] }),
      EMBED_ORIGIN,
    );
  }, [muted]);

  return (
    <>
      <img
        src={cover}
        alt=""
        onError={() => setCover(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`)}
        className="absolute inset-0 h-full w-full object-cover"
      />
      {active && (
        <iframe
          ref={frame}
          title="YouTube Short"
          src={`${EMBED_ORIGIN}/embed/${id}?autoplay=1&mute=${muted ? 1 : 0}&loop=1&playlist=${id}&playsinline=1&controls=0&rel=0&modestbranding=1&enablejsapi=1`}
          allow="autoplay; encrypted-media; picture-in-picture"
          className="absolute inset-0 h-full w-full border-0"
        />
      )}
    </>
  );
}

function UploadedReel({ url, active, muted }: { url: string; active: boolean; muted: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (active) {
      v.muted = muted;
      v.currentTime = 0;
      void v.play().then(() => setPaused(false)).catch(() => setPaused(true));
    } else v.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sound changes must not restart the video
  }, [active]);
  useEffect(() => {
    if (video.current) video.current.muted = muted;
  }, [muted]);

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) void v.play().then(() => setPaused(false));
    else {
      v.pause();
      setPaused(true);
    }
  };

  return (
    <button type="button" onClick={toggle} aria-label={paused ? "Play" : "Pause"} className="absolute inset-0 h-full w-full">
      <video ref={video} src={url} loop playsInline muted={muted} preload={active ? "auto" : "metadata"} className="h-full w-full object-cover" />
      {paused && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Play className="h-16 w-16 fill-current text-reel-foreground opacity-80" />
        </span>
      )}
    </button>
  );
}

export function ReelSlide({
  reel,
  active,
  muted,
  onToggleSound,
}: {
  reel: FeedReel;
  active: boolean;
  muted: boolean;
  onToggleSound: () => void;
}) {
  const shareUrl = reel.kind === "youtube" ? `https://www.youtube.com/shorts/${reel.videoId}` : `${typeof window !== "undefined" ? window.location.origin : ""}/reels`;

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: reel.title || "Novels Forever reel", url: shareUrl });
      else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Link copied");
      }
    } catch {
      /* share cancelled */
    }
  };

  return (
    <div className="relative mx-auto aspect-[9/16] h-full max-w-full overflow-hidden bg-reel sm:rounded-2xl">
      {reel.kind === "youtube" ? (
        <YoutubeReel id={reel.videoId} active={active} muted={muted} />
      ) : (
        <UploadedReel url={reel.url} active={active} muted={muted} />
      )}
      <div className="reel-shade pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 pb-24 pr-20 text-reel-foreground sm:pb-6">
        <p className="text-sm font-semibold">@NovelsForever</p>
        {reel.title && <p className="mt-1 line-clamp-3 text-sm">{reel.title}</p>}
        {reel.kind === "youtube" && reel.views && <p className="mt-1 text-xs opacity-75">{reel.views}</p>}
      </div>
      <div className="absolute bottom-24 right-3 flex flex-col items-center gap-3 sm:bottom-6">
        <Button variant="reel" size="icon" className="h-12 w-12" aria-label={muted ? "Turn sound on" : "Turn sound off"} onClick={onToggleSound}>
          {muted ? <VolumeX className="!size-5" /> : <Volume2 className="!size-5" />}
        </Button>
        <Button variant="reel" size="icon" className="h-12 w-12" aria-label="Share" onClick={() => void share()}>
          <Share2 className="!size-5" />
        </Button>
        {reel.kind === "youtube" && (
          <Button asChild variant="reel" size="icon" className="h-12 w-12">
            <a href={shareUrl} target="_blank" rel="noreferrer" aria-label="Open on YouTube"><ExternalLink className="!size-5" /></a>
          </Button>
        )}
      </div>
    </div>
  );
}
