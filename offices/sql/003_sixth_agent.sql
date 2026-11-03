-- Six agents per office, one per desk: two blue heads, two glitch, two white smoke. The sixth is a real row, so the room shows nothing that isn't reported.
insert into public.office_agents (office, id, name, role, color, seat)
select o.id, 'assist', 'Assist', 'helps wherever it is needed', '#e8e8ee', 5
from public.offices o
where exists (select 1 from public.office_agents a where a.office = o.id)
on conflict do nothing;
