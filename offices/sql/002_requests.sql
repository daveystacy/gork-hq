-- One-click answers from the office page: a chat asks with office_ask, the owner clicks a button next to Open chat,
-- and the chat reads the answer with office_request_check. Anyone can read a request (the offices are public pages);
-- answering needs the owner's passcode, whose SHA-256 is the only copy kept here.

create table public.office_requests (
  id bigint generated always as identity primary key,
  office text not null references public.offices(id) on delete cascade,
  agent text not null,
  question text not null check (char_length(question) between 1 and 300),
  options text[] not null default array['Approve','Decline'] check (cardinality(options) between 2 and 4),
  status text not null default 'pending' check (status in ('pending','answered','cancelled')),
  answer text,
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  seen_at timestamptz
);
create index office_requests_open_idx on public.office_requests (office, created_at) where status = 'pending' or seen_at is null;

create table public.office_owner_key (
  id int primary key default 1 check (id = 1),
  pass_sha256 text not null
);

alter table public.office_requests enable row level security;
alter table public.office_owner_key enable row level security;
create policy office_requests_public_read on public.office_requests for select to anon, authenticated using (true);
-- office_owner_key has no policies on purpose: the public API can never read it.

-- Chats only. Money never goes through a button: the owner approves real money, on-chain mints and wallet signing in the
-- chat. The word check is a backstop for that rule, not the rule; a false match just sends the question to the chat.
create function public.office_ask(p_office text, p_agent text, p_question text, p_options text[] default array['Approve','Decline'])
returns bigint language plpgsql set search_path = public, pg_temp as $$
declare new_id bigint;
begin
  if p_question ~* '\m(sol|lamports?|wallets?|on-?chain|mainnet|treasury|payments?|withdraw\w*|refunds?|seed phrase|private key|sign(ing)? (a |the )?(tx|transaction))\M' then
    raise exception 'Money and on-chain approvals are asked in the chat, not with a button';
  end if;
  if exists (select 1 from unnest(p_options) o where char_length(o) not between 1 and 24) then
    raise exception 'Each option must be 1 to 24 characters';
  end if;
  insert into public.office_requests (office, agent, question, options) values (p_office, p_agent, p_question, p_options) returning id into new_id;
  perform public.office_report(p_office, p_agent, 'waiting_user', p_question);
  return new_id;
end $$;

-- Chats only. Marks an answer as picked up, so the office stops saying the chat hasn't seen it.
create function public.office_request_check(p_id bigint)
returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare r public.office_requests;
begin
  update public.office_requests set seen_at = coalesce(seen_at, now()) where id = p_id and status = 'answered' returning * into r;
  if not found then select * into r from public.office_requests where id = p_id; end if;
  if not found then raise exception 'no request %', p_id; end if;
  return jsonb_build_object('status', r.status, 'answer', r.answer, 'answered_at', r.answered_at);
end $$;

-- Chats only: take back a question that no longer needs an answer.
create function public.office_request_cancel(p_id bigint)
returns void language plpgsql set search_path = public, pg_temp as $$
begin
  update public.office_requests set status = 'cancelled' where id = p_id and status = 'pending';
end $$;

create function public.office_owner_check(p_pass text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(encode(sha256(convert_to(coalesce(p_pass, ''), 'UTF8')), 'hex') = (select pass_sha256 from public.office_owner_key where id = 1), false);
$$;

-- The page calls this. Needs the passcode, and only accepts one of the options the chat offered, once.
create function public.office_answer(p_pass text, p_id bigint, p_answer text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.office_requests;
begin
  if not public.office_owner_check(p_pass) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  update public.office_requests set status = 'answered', answer = p_answer, answered_at = now()
    where id = p_id and status = 'pending' and p_answer = any(options) returning * into r;
  if not found then
    raise exception 'That question is no longer open' using errcode = 'P0002';
  end if;
  -- the agent is no longer waiting on the owner; the office says separately that the chat hasn't picked it up yet
  if not exists (select 1 from public.office_requests where office = r.office and agent = r.agent and status = 'pending') then
    if exists (select 1 from public.office_agents where office = r.office and id = r.agent and state = 'waiting_user') then
      perform public.office_report(r.office, r.agent, 'idle', null, null, 'Owner answered "' || p_answer || '": ' || left(r.question, 200));
    end if;
  end if;
  return jsonb_build_object('ok', true, 'status', r.status, 'answer', r.answer);
end $$;

revoke all on function public.office_ask(text, text, text, text[]) from public, anon, authenticated;
revoke all on function public.office_request_check(bigint) from public, anon, authenticated;
revoke all on function public.office_request_cancel(bigint) from public, anon, authenticated;
revoke all on function public.office_owner_check(text) from public;
revoke all on function public.office_answer(text, bigint, text) from public;
grant execute on function public.office_owner_check(text), public.office_answer(text, bigint, text) to anon, authenticated;
grant select on public.office_requests to anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.office_requests from anon, authenticated;
revoke all on public.office_owner_key from anon, authenticated;

alter publication supabase_realtime add table public.office_requests;
