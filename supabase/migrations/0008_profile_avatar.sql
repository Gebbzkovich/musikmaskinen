-- 0008_profile_avatar: avatar image on profiles + a public 'avatars' storage bucket.
alter table profiles add column avatar_url text;

-- Public-read bucket for profile pictures.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Storage RLS: anyone can read an avatar; a user may write/replace/delete only
-- files under a folder named after their own uid (path: avatars/<uid>/...).
create policy "avatars public read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'avatars');
create policy "avatars insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
