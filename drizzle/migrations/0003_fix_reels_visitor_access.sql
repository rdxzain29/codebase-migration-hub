drop policy "Visible reels are public" on public.reels;
create policy "Visible reels are public" on public.reels for select to anon, authenticated
  using (hidden = false);
create policy "Admins see all reels" on public.reels for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));