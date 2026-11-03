-- A chat that needs the owner posts a question here; the owner answers with one click in the office.
-- The offices are public pages, so a click only counts with the owner key, kept here only as a hash.
create table public.office_asks (
  id bigint generated always as identity primary key,
  office text not null references public.offices(id) on delete cascade,
  question text not null check (char_length(question) between 1 and 300),
  options text[] not null default array['Approve','Not now'] check (cardinality(options) between 1 and 4),
  status text not null default 'open' check (status in ('open','answered','withdrawn')),
  answer text,
  created_at timestamptz not null default now(),
  answered_at timestamptz
);
create index office_asks_open_idx on public.office_asks (office, status, created_at);
create table public.office_owner_key (id int primary key default 1 check (id = 1), key_sha256 text not null);

alter table public.office_asks enable row level security;
alter table public.office_owner_key enable row level security;
create policy office_asks_public_read on public.office_asks for select to anon, authenticated using (true);
-- office_owner_key has no policies on purpose: the public API can never read it.
revoke all on public.office_owner_key from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.office_asks from anon, authenticated;
grant select on public.office_asks to anon, authenticated;

-- from a chat: select office_ask('lobby', 'Merge PR 95 to expire.org?');  returns the id to read the answer back with
create function public.office_ask(p_office text, p_question text, p_options text[] default array['Approve','Not now'])
returns bigint language plpgsql security definer set search_path = '' as $$
declare out_id bigint;
begin
  insert into public.office_asks (office, question, options) values (p_office, p_question, p_options) returning id into out_id;
  perform public.office_log_add(p_office, 'Asked the owner: ' || left(p_question, 200), null, 'chat');
  update public.offices set updated_at = now() where id = p_office;
  return out_id;
end $$;

-- from a chat, when a question no longer applies
create function public.office_ask_withdraw(p_id bigint) returns void language sql security definer set search_path = '' as $$
  update public.office_asks set status = 'withdrawn' where id = p_id and status = 'open';
$$;

-- from the page: only the owner key counts, and only one of the offered answers, once
create function public.office_answer(p_id bigint, p_answer text, p_key text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare a public.office_asks;
begin
  if p_key is null or encode(sha256(convert_to(p_key, 'UTF8')), 'hex') is distinct from (select key_sha256 from public.office_owner_key where id = 1) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  update public.office_asks set status = 'answered', answer = p_answer, answered_at = now()
    where id = p_id and status = 'open' and p_answer = any(options) returning * into a;
  if a.id is null then return jsonb_build_object('ok', false); end if;
  perform public.office_log_add(a.office, 'Owner answered "' || p_answer || '": ' || left(a.question, 200), null, 'chat');
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.office_ask(text, text, text[]) from public, anon, authenticated;
revoke all on function public.office_ask_withdraw(bigint) from public, anon, authenticated;
revoke all on function public.office_answer(bigint, text, text) from public;
grant execute on function public.office_answer(bigint, text, text) to anon, authenticated;
alter publication supabase_realtime add table public.office_asks;
