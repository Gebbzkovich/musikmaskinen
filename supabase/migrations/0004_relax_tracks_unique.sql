-- 0004_relax_tracks_unique: the (artist_name, track_name) unique constraint from
-- 0002 is too strict for real iTunes data, where the same artist+title appears as
-- multiple distinct recordings (remix, live, re-release) with different trackIds.
-- Track identity is now itunes_track_id (unique, added in 0003); drop the old one.
alter table tracks drop constraint if exists tracks_artist_name_track_name_key;
