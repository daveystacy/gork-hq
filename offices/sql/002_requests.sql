-- Approve buttons in the offices. A chat posts a question; the owner clicks Approve or Decline next to Open chat.
-- The question is public like every other report. Only someone with the owner passcode can decide it.

create table public.office_requests (
  id bigserial primary key,
  office text not null references public.offices(id) on delete cascade,
  agent text not null,
  question text not null check (char_length(question) between 3 and 300),
  approve_label text not null default 'Approve' check (char_length(approve_label) between 1 and 24),
  decline_label text not null default 'Decline' check (char_length(decline_label) between 1 and 24),
  status text not null default 'pending' check (status in ('pending','approved','declined','cancelled')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index office_requests_pending on public.office_requests (office, created_at) where status = 'pending';
alter table public.office_requests enable row level security;
create policy office_requests_public_read on public.office_requests for select to anon, authenticated using (true);
revoke insert, update, delete, truncate, references, trigger on public.office_requests from anon, authenticated;
grant select on public.office_requests to anon, authenticated;

-- only a hash is stored; set it with: update office_owner_secret set pass_sha256 = '<sha256 of the passcode>' where id = 1;
create table public.office_owner_secret (id int primary key check (id = 1), pass_sha256 text);
alter table public.office_owner_secret enable row level security;
revoke all on public.office_owner_secret from anon, authenticated;

create function public.office_owner_ok(p_pass text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select p_pass is not null and encode(sha256(convert_to(p_pass, 'UTF8')), 'hex') = (select pass_sha256 from public.office_owner_secret where id = 1)
$$;

-- a chat asks. Real money, token launches, NFT purchases, wallet signing and secrets are never decided by a button: they stay in the chat.
create function public.office_request(p_office text, p_agent text, p_question text, p_approve text default 'Approve', p_decline text default 'Decline')
returns bigint language plpgsql set search_path = public, pg_temp as $$
declare new_id bigint;
begin
  if p_question ~* '(real money|token launch|nft purchase|wallet|seed phrase|private key|mainnet)' then
    raise exception 'This needs the owner''s approval in the chat, not an office button';
  end if;
  insert into public.office_requests (office, agent, question, approve_label, decline_label)
    values (p_office, p_agent, p_question, coalesce(p_approve, 'Approve'), coalesce(p_decline, 'Decline')) returning id into new_id;
  perform public.office_report(p_office, p_agent, 'waiting_user', p_question);
  return new_id;
end $$;

-- the owner answered in the chat instead, or the question no longer applies
create function public.office_request_cancel(p_id bigint) returns void
language sql set search_path = public, pg_temp as $$
  update public.office_requests set status = 'cancelled', decided_at = now() where id = p_id and status = 'pending'
$$;

-- the button
create function public.office_decide(p_pass text, p_id bigint, p_decision text) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.office_requests;
begin
  if not public.office_owner_ok(p_pass) then raise exception 'unauthorized' using errcode = '42501'; end if;
  if p_decision not in ('approved', 'declined') then raise exception 'bad decision'; end if;
  update public.office_requests set status = p_decision, decided_at = now() where id = p_id and status = 'pending' returning * into r;
  if not found then return 'already decided'; end if;
  perform public.office_log_add(r.office, 'Owner chose ' || case when p_decision = 'approved' then r.approve_label else r.decline_label end || ': ' || r.question, r.agent, 'chat');
  if not exists (select 1 from public.office_requests where office = r.office and agent = r.agent and status = 'pending') then
    perform public.office_report(r.office, r.agent, 'idle');
  end if;
  return p_decision;
end $$;

revoke all on function public.office_owner_ok(text) from public;
revoke all on function public.office_decide(text, bigint, text) from public;
revoke all on function public.office_request(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.office_request_cancel(bigint) from public, anon, authenticated;
grant execute on function public.office_owner_ok(text), public.office_decide(text, bigint, text) to anon, authenticated;
alter publication supabase_realtime add table public.office_requests;
