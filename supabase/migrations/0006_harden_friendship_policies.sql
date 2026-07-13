-- 0006_harden_friendship_policies: the 0005 friendship policies allowed forging an
-- 'accepted' friendship without the other party's consent (insert didn't constrain
-- status; update let the requester self-accept). Since get_or_create_direct_conversation
-- authorizes on status='accepted', that bypassed the "accepted friends only" gate.
-- A friendship may only be created as 'pending' by the requester, and only the
-- addressee may move pending -> accepted.

drop policy "friendships insert own" on friendships;
create policy "friendships insert own" on friendships
  for insert to authenticated
  with check (requester_id = auth.uid() and status = 'pending');

drop policy "friendships update party" on friendships;
create policy "friendships accept by addressee" on friendships
  for update to authenticated
  using (addressee_id = auth.uid() and status = 'pending')
  with check (addressee_id = auth.uid() and status = 'accepted');

-- Requester may cancel a pending request they sent.
create policy "friendships delete own pending" on friendships
  for delete to authenticated
  using (requester_id = auth.uid() and status = 'pending');

-- Tighten SECURITY DEFINER helper grants: Postgres grants EXECUTE to PUBLIC by
-- default, which needlessly exposes these to anon via PostgREST. Restrict to authenticated.
revoke execute on function is_conversation_member(uuid, uuid) from public;
grant execute on function is_conversation_member(uuid, uuid) to authenticated;
revoke execute on function get_or_create_direct_conversation(uuid) from public;
grant execute on function get_or_create_direct_conversation(uuid) to authenticated;
