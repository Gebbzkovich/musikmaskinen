-- 0007_surprise_track: "Överraska mig" — return one random real track together
-- with the subgenre it belongs to, for the shuffle/radio discovery mode.
create function get_surprise_track()
  returns table (
    track_id uuid, track_name text, artist_name text, artwork_url text,
    preview_url text, apple_music_url text, duration_ms int, itunes_track_id bigint,
    subgenre_slug text, subgenre_name text, subgenre_color text
  )
  language sql stable security definer set search_path = public as $$
  select t.id, t.track_name, t.artist_name, t.artwork_url, t.preview_url,
         t.apple_music_url, t.duration_ms, t.itunes_track_id, g.slug, g.name, g.color
  from subgenre_tracks st
  join tracks t on t.id = st.track_id
  join genres g on g.id = st.genre_id
  where g.slug is not null and t.preview_url is not null
  order by random()
  limit 1;
$$;

grant execute on function get_surprise_track() to anon, authenticated;
