import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseYoutubeId } from "@/lib/youtube";

export const MAX_REEL_BYTES = 100 * 1024 * 1024;
export const REEL_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

export type ManualReel = {
  id: string;
  kind: "upload" | "youtube";
  video_id: string | null;
  file_path: string | null;
  title: string;
  hidden: boolean;
  created_at: string;
  /** Playable address for uploaded videos. */
  url: string | null;
};

/** One item in the reels feed: a YouTube Short or a video the owner uploaded. */
export type FeedReel =
  | { key: string; kind: "youtube"; videoId: string; title: string; views: string | null }
  | { key: string; kind: "upload"; url: string; title: string };

async function withUrls(rows: Omit<ManualReel, "url">[]): Promise<ManualReel[]> {
  const paths = rows.filter((r) => r.kind === "upload" && r.file_path).map((r) => r.file_path as string);
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage.from("reels").createSignedUrls(paths, 60 * 60 * 6);
    for (const item of data ?? []) if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  }
  return rows.map((r) => ({ ...r, url: r.file_path ? urls.get(r.file_path) ?? null : null }));
}

/** Reels the owner added by hand (visible ones for visitors; all of them for the owner). */
export const manualReelsQuery = (scope: "public" | "admin" = "public") =>
  queryOptions({
    queryKey: ["reels", "manual", scope],
    queryFn: async () => {
      let q = supabase
        .from("reels")
        .select("id, kind, video_id, file_path, title, hidden, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (scope === "public") q = q.eq("hidden", false);
      const { data, error } = await q;
      if (error) throw error;
      return withUrls((data ?? []) as Omit<ManualReel, "url">[]);
    },
    staleTime: 60_000,
  });

export function manualToFeed(reels: ManualReel[]): FeedReel[] {
  const out: FeedReel[] = [];
  for (const r of reels) {
    if (r.hidden) continue;
    if (r.kind === "youtube" && r.video_id) out.push({ key: `m-${r.id}`, kind: "youtube", videoId: r.video_id, title: r.title, views: null });
    else if (r.kind === "upload" && r.url) out.push({ key: `m-${r.id}`, kind: "upload", url: r.url, title: r.title });
  }
  return out;
}

export async function addYoutubeReel(link: string, title: string) {
  const id = parseYoutubeId(link);
  if (!id) throw new Error("That is not a YouTube link.");
  const { error } = await supabase.from("reels").insert({ kind: "youtube", video_id: id, title: title.trim().slice(0, 200) });
  if (error) throw error;
}

export async function uploadReel(file: File, title: string) {
  if (!REEL_TYPES.includes(file.type) && !/\.(mp4|webm|mov)$/i.test(file.name)) {
    throw new Error("Please choose an MP4, WebM or MOV video.");
  }
  if (file.size > MAX_REEL_BYTES) throw new Error("The video is larger than 100 MB.");
  const ext = (/\.(mp4|webm|mov)$/i.exec(file.name)?.[1] ?? "mp4").toLowerCase();
  const path = `${crypto.randomUUID()}.${ext}`;
  const type = file.type || (ext === "mov" ? "video/quicktime" : `video/${ext}`);
  const { error: upErr } = await supabase.storage.from("reels").upload(path, file, { contentType: type });
  if (upErr) throw upErr;
  const { error } = await supabase.from("reels").insert({ kind: "upload", file_path: path, title: title.trim().slice(0, 200) });
  if (error) {
    await supabase.storage.from("reels").remove([path]);
    throw error;
  }
}

export async function setReelHidden(id: string, hidden: boolean) {
  const { error } = await supabase.from("reels").update({ hidden }).eq("id", id);
  if (error) throw error;
}

export async function deleteReel(reel: Pick<ManualReel, "id" | "file_path">) {
  const { error } = await supabase.from("reels").delete().eq("id", reel.id);
  if (error) throw error;
  if (reel.file_path) await supabase.storage.from("reels").remove([reel.file_path]);
}
