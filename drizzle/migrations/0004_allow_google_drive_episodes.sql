ALTER TABLE public.catalog_videos DROP CONSTRAINT catalog_videos_source_check;
ALTER TABLE public.catalog_videos ADD CONSTRAINT catalog_videos_source_check
  CHECK (source = ANY (ARRAY['youtube'::text, 'gdrive'::text, 'terabox'::text]));
ALTER TABLE public.catalog_videos DROP CONSTRAINT catalog_videos_video_id_check;
ALTER TABLE public.catalog_videos ADD CONSTRAINT catalog_videos_video_id_check
  CHECK (
    (source = 'youtube' AND video_id ~ '^[A-Za-z0-9_-]{11}$')
    OR (source = 'gdrive' AND video_id ~ '^gd-[A-Za-z0-9_-]{20,100}$')
    OR (source = 'terabox' AND video_id ~ '^tb-[A-Za-z0-9_-]{4,80}$')
  );