import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Eye, EyeOff, Film, Link2, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addYoutubeReel, deleteReel, manualReelsQuery, setReelHidden, uploadReel, type ManualReel } from "@/lib/reels";
import { getChannelShorts } from "@/lib/reels.functions";

/** Owner tools for the Reels feed: upload a video or add a Shorts link by hand. */
export function ReelsPanel() {
  const qc = useQueryClient();
  const fetchShorts = useServerFn(getChannelShorts);
  const { data: reels, isLoading } = useQuery(manualReelsQuery("admin"));
  const { data: firstShorts } = useQuery({
    queryKey: ["reels", "channel-shorts", "admin-count"],
    queryFn: () => fetchShorts({ data: {} }),
    staleTime: 15 * 60 * 1000,
  });
  const [mode, setMode] = useState<"upload" | "youtube">("upload");
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["reels", "manual"] });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "upload") {
        if (!file) throw new Error("Please choose a video file.");
        await uploadReel(file, title);
        setFile(null);
        if (fileInput.current) fileInput.current.value = "";
      } else {
        await addYoutubeReel(link, title);
        setLink("");
      }
      setTitle("");
      toast.success("Reel added — it now shows first in Reels.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add the reel.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (reel: ManualReel) => {
    try {
      await setReelHidden(reel.id, !reel.hidden);
      await refresh();
    } catch {
      toast.error("Could not update the reel.");
    }
  };

  const remove = async (reel: ManualReel) => {
    if (!window.confirm("Delete this reel?")) return;
    try {
      await deleteReel(reel);
      toast.success("Reel deleted.");
      await refresh();
    } catch {
      toast.error("Could not delete the reel.");
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl">Reels</h2>
          <p className="text-sm text-muted-foreground">
            All YouTube Shorts from the channel appear in Reels automatically
            {firstShorts?.items.length ? ` (${firstShorts.items.length}${firstShorts.next ? "+" : ""} found)` : ""}. Reels you add here show first.
          </p>
        </div>
        <Button asChild variant="glass"><Link to="/reels"><Film /> Open Reels</Link></Button>
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card-grad p-5">
        <div className="grid grid-cols-2 gap-1 rounded-full border border-border p-1 sm:max-w-sm" role="tablist" aria-label="Reel source">
          {(["upload", "youtube"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className="flex items-center justify-center gap-1.5 rounded-full py-2 text-sm font-medium text-muted-foreground aria-selected:bg-gold aria-selected:text-primary-foreground"
            >
              {m === "upload" ? <><Upload className="h-4 w-4" /> Upload video</> : <><Link2 className="h-4 w-4" /> YouTube link</>}
            </button>
          ))}
        </div>
        {mode === "upload" ? (
          <div className="space-y-1.5">
            <Label htmlFor="reel-file">Video file (MP4, WebM or MOV, up to 100 MB — vertical works best)</Label>
            <Input id="reel-file" ref={fileInput} type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="reel-link">YouTube Shorts link</Label>
            <Input id="reel-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://youtube.com/shorts/…" required />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="reel-title">Caption (optional)</Label>
          <Input id="reel-title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="A line shown on the reel" />
        </div>
        <Button type="submit" variant="gold" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Upload />} {busy && mode === "upload" ? "Uploading…" : "Add reel"}
        </Button>
      </form>

      <div>
        <h3 className="font-display text-2xl">Your reels</h3>
        {isLoading ? (
          <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
        ) : !reels?.length ? (
          <p className="mt-2 text-sm text-muted-foreground">No reels added by hand yet.</p>
        ) : (
          <ul className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {reels.map((r) => (
              <li key={r.id} className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="relative aspect-[9/16] bg-reel">
                  {r.kind === "youtube" && r.video_id ? (
                    <img src={`https://i.ytimg.com/vi/${r.video_id}/hqdefault.jpg`} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : r.url ? (
                    <video src={r.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                  ) : null}
                  {r.hidden && <span className="absolute left-2 top-2 rounded bg-reel/80 px-2 py-0.5 text-xs text-reel-foreground">Hidden</span>}
                </div>
                <div className="space-y-2 p-2">
                  <p className="line-clamp-2 min-h-8 text-xs">{r.title || (r.kind === "youtube" ? "YouTube Short" : "Uploaded video")}</p>
                  <div className="flex gap-1">
                    <Button size="icon-sm" variant="glass" aria-label={r.hidden ? "Show reel" : "Hide reel"} onClick={() => void toggle(r)}>
                      {r.hidden ? <Eye /> : <EyeOff />}
                    </Button>
                    <Button size="icon-sm" variant="glass" aria-label="Delete reel" onClick={() => void remove(r)}>
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
