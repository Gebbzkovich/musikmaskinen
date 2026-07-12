-- 0001_init: bootstrap migration for Musikmaskinen.
-- Verifies the migration chain end-to-end before real schema lands in Fas 0.

create extension if not exists pg_trgm;

-- Placeholder smoke-test table. Proves `supabase db push` applies migrations
-- to the linked remote. Removed in the next migration.
create table if not exists _migrations_smoke_test (
  id int primary key
);
