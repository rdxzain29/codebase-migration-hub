import { useEffect, useState } from "react";
import { Youtube } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BrandIcon } from "@/components/nadia/BrandIcon";
import { channel, totalVideos } from "@/lib/catalog";
import { media } from "@/lib/media";
import { NADIA_SOCIALS } from "@/lib/owner-profile";

const whatsappChannel = NADIA_SOCIALS.find((s) => s.id === "whatsapp");

const KEY = "nf-yt-popup";

export function YoutubePopup() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(KEY)) return;
    } catch {
      return;
    }
    const dismissForChat = () => {
      window.clearTimeout(t);
      setOpen(false);
      try {
        sessionStorage.setItem(KEY, "1");
      } catch {
        /* ignore */
      }
    };
    const t = window.setTimeout(() => {
      setOpen(true);
      try {
        sessionStorage.setItem(KEY, "1");
      } catch {
        /* ignore */
      }
    }, 20000);
    window.addEventListener("nf:agent-open", dismissForChat);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("nf:agent-open", dismissForChat);
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="bg-card-grad gold-frame w-[calc(100%-2rem)] max-w-sm gap-0 overflow-hidden rounded-2xl p-0 text-center sm:max-w-md sm:rounded-2xl">
        <div className="relative px-6 pb-2 pt-8 sm:px-8">
          <div className="bg-glow-radial pointer-events-none absolute left-1/2 top-2 h-40 w-40 -translate-x-1/2" aria-hidden />
          <img src={media.logo} alt="" className="animate-float relative mx-auto h-20 w-20" />
          <DialogHeader className="relative mt-4 items-center space-y-2 text-center sm:text-center">
            <DialogTitle className="font-display text-2xl leading-tight text-gold sm:text-3xl">
              Visit our YouTube channel
            </DialogTitle>
            <DialogDescription className="mx-auto max-w-xs text-sm leading-relaxed">
              {totalVideos.toLocaleString()}+ Urdu audio novels with full text. Subscribe to{" "}
              {channel.name} so you never miss a new episode.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="flex flex-col gap-3 px-6 pb-6 pt-4 sm:px-8 sm:pb-7">
          <Button asChild variant="youtube" size="lg" className="w-full">
            <a href={`${channel.url}?sub_confirmation=1`} target="_blank" rel="noreferrer">
              <Youtube /> Subscribe on YouTube
            </a>
          </Button>
          {whatsappChannel ? (
            <Button asChild variant="whatsapp" size="lg" className="w-full">
              <a href={whatsappChannel.url} target="_blank" rel="noreferrer">
                <BrandIcon id="whatsapp" className="h-5 w-5" /> Join WhatsApp channel
              </a>
            </Button>
          ) : null}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mx-auto mt-1 cursor-pointer rounded-md px-3 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Maybe later
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
