create table public.reels (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('upload', 'youtube')),
  video_id text check (video_id is null or video_id ~ '^[A-Za-z0-9_-]{11}$'),
  file_path text check (file_path is null or char_length(file_path) <= 300),
  title text not null default '' check (char_length(title) <= 200),
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  constraint reels_source_check check (
    (kind = 'youtube' and video_id is not null) or (kind = 'upload' and file_path is not null)
  )
);
create index reels_created_idx on public.reels (created_at desc);
grant select on public.reels to anon, authenticated;
grant insert, update, delete on public.reels to authenticated;
grant all on public.reels to service_role;
alter table public.reels enable row level security;
create policy "Visible reels are public" on public.reels for select to anon, authenticated
  using (hidden = false or public.has_role(auth.uid(), 'admin'));
create policy "Admins add reels" on public.reels for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins update reels" on public.reels for update to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins delete reels" on public.reels for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create function public.is_registered_reel(_path text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.reels where file_path = _path and hidden = false)
$$;
revoke all on function public.is_registered_reel(text) from public;
grant execute on function public.is_registered_reel(text) to anon, authenticated;

create policy "Visitors watch registered reels" on storage.objects for select to anon, authenticated
  using (bucket_id = 'reels' and public.is_registered_reel(name));
create policy "Admins read reel files" on storage.objects for select to authenticated
  using (bucket_id = 'reels' and public.has_role(auth.uid(), 'admin'));
create policy "Admins upload reel files" on storage.objects for insert to authenticated
  with check (bucket_id = 'reels' and public.has_role(auth.uid(), 'admin'));
create policy "Admins update reel files" on storage.objects for update to authenticated
  using (bucket_id = 'reels' and public.has_role(auth.uid(), 'admin'));
create policy "Admins delete reel files" on storage.objects for delete to authenticated
  using (bucket_id = 'reels' and public.has_role(auth.uid(), 'admin'));

alter table public.reviews add column user_id uuid default auth.uid();
drop policy "Anyone can review" on public.reviews;
revoke insert on public.reviews from anon;
create policy "Signed-in readers can review" on public.reviews for insert to authenticated
  with check (
    user_id = auth.uid()
    and novel_slug ~ '^[a-z0-9-]+$' and char_length(novel_slug) <= 200
  );

create or replace function public.is_allowed_signup_email(_email text)
returns boolean language sql immutable set search_path = public as $$
  select coalesce(lower(split_part(_email, '@', 2)), '') ~ '^(gmail\.com|googlemail\.com|msn\.com|(outlook|hotmail|live)\.[a-z]{2,3}(\.[a-z]{2})?)$'
$$;
grant execute on function public.is_allowed_signup_email(text) to anon, authenticated;

create or replace function public.enforce_signup_email_domain()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is null
     and coalesce(new.raw_app_meta_data ->> 'provider', 'email') = 'email'
     and not public.is_allowed_signup_email(new.email) then
    raise exception 'Only Gmail or Outlook email addresses can create an account'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_signup_email_domain() from public, anon, authenticated;
create trigger enforce_signup_email_domain before insert on auth.users
  for each row execute function public.enforce_signup_email_domain();