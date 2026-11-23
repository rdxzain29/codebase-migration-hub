/** Video links the owner can paste: YouTube (any link form) or a Google Drive video file. */
import { parseYoutubeId } from "@/lib/youtube";

export type VideoSource = "youtube" | "gdrive";

export type ParsedVideo =
  | { source: "youtube"; id: string; shareUrl: null }
  | { source: "gdrive"; id: string; fileId: string; shareUrl: string };

/* ------------------------------ Google Drive ------------------------------ */

const DRIVE_HOSTS = ["drive.google.com", "docs.google.com", "drive.usercontent.google.com"];

/** File id of a Google Drive link: ".../file/d/<id>/view", "open?id=<id>", "uc?id=<id>". */
export function parseDriveFileId(input: string): string | null {
  let url: URL;
  try {
    const v = input.trim();
    url = new URL(v.startsWith("http") ? v : `https://${v}`);
  } catch {
    return null;
  }
  if (!DRIVE_HOSTS.includes(url.hostname.toLowerCase())) return null;
  const id = /\/file\/d\/([A-Za-z0-9_-]+)/.exec(url.pathname)?.[1] ?? url.searchParams.get("id");
  return id && /^[A-Za-z0-9_-]{20,100}$/.test(id) ? id : null;
}

export const isDriveId = (id: string) => id.startsWith("gd-");
export const driveFileId = (id: string) => id.slice(3);
export const driveEmbedUrl = (fileId: string) => `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`;
export const driveShareUrl = (fileId: string) => `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`;
export const driveThumbUrl = (fileId: string) => `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w640`;

/* --------------------------- TeraBox (old parts) --------------------------- */

/** TeraBox no longer lets its videos play on other sites; old saved parts are only recognised, never offered. */
const TERABOX_HOSTS = [
  "terabox.com", "1024terabox.com", "teraboxapp.com", "terabox.app", "1024tera.com", "4funbox.com",
  "mirrobox.com", "nephobox.com", "momerybox.com", "tibibox.com", "freeterabox.com", "terabox.club",
  "terasharelink.com", "teraboxlink.com", "terafileshare.com", "teraboxshare.com",
];

export function isTeraboxLink(input: string): boolean {
  try {
    const v = input.trim();
    const host = new URL(v.startsWith("http") ? v : `https://${v}`).hostname.toLowerCase().replace(/^www\./, "");
    return TERABOX_HOSTS.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

export const isTeraboxId = (id: string) => id.startsWith("tb-");

/* --------------------------------- Shared --------------------------------- */

export function parseVideoLink(input: string): ParsedVideo | null {
  const fileId = parseDriveFileId(input);
  if (fileId) return { source: "gdrive", id: `gd-${fileId}`, fileId, shareUrl: driveShareUrl(fileId) };
  const id = parseYoutubeId(input);
  return id ? { source: "youtube", id, shareUrl: null } : null;
}

/** Where a saved part's video lives. */
export const sourceOf = (id: string): VideoSource | "terabox" =>
  isDriveId(id) ? "gdrive" : isTeraboxId(id) ? "terabox" : "youtube";

/** Parts that can play inside the site (old TeraBox parts cannot). */
export const isPlayableId = (id: string) => !isTeraboxId(id);

export const youtubeEmbedUrl = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?rel=0`;

/** Player URL for a playable episode id (YouTube id or "gd-<file id>"). */
export const embedUrlFor = (id: string) => (isDriveId(id) ? driveEmbedUrl(driveFileId(id)) : youtubeEmbedUrl(id));

/** Clean a video file name ("Novel _ Episode 1 _ Writer.mp4") into a title. */
export function titleFromFileName(name: string): string {
  return name
    .replace(/\.(mp4|mkv|mov|webm|avi|m4v)$/i, "")
    .replace(/\s+_\s+/g, " | ")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Link that opens a part on its own site (owner area only). */
export const watchUrlFor = (id: string) =>
  isDriveId(id)
    ? driveShareUrl(driveFileId(id))
    : isTeraboxId(id)
      ? `https://www.1024terabox.com/s/1${id.slice(3)}`
      : `https://www.youtube.com/watch?v=${id}`;
