-- a sixth seat in each office, so every robot in the room is a real row
insert into public.office_agents (office, id, name, role, color, seat)
select o.id, 'support', 'Support', 'extra hands for the team', '#e8c66a', 5 from public.offices o
on conflict do nothing;
