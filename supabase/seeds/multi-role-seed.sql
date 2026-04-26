-- Multi-role demo seed.
-- Safe to re-run. It resets only rows tagged with metadata.demo = multi-role
-- plus the three deterministic demo staff users.

update institutions
set domain = 'engineering'
where acronym = 'ENIB'
   or code = '431'
   or name_fr ilike '%Ingénieurs de Bizerte%'
   or name_fr ilike '%Ingenieurs de Bizerte%';

insert into app_settings (id, current_simulated_date, updated_at)
values ('demo', '2026-04-23T09:00:00Z', now())
on conflict (id) do update
set current_simulated_date = excluded.current_simulated_date,
    updated_at = now();

delete from notifications
where payload->>'demo' = 'multi-role'
   or user_id in ('yassine_enib', 'director_enib', 'dean_engineering')
   or id = '00000000-0000-4000-8000-000000000003';

delete from ticket_messages
where metadata->>'demo' = 'multi-role'
   or ticket_id in (
     select id from tickets where metadata->>'demo' = 'multi-role'
   );

delete from tickets
where metadata->>'demo' = 'multi-role'
   or id = '00000000-0000-4000-8000-000000000001';

insert into admin_staff_users (
  id,
  name,
  role,
  institution_id,
  domain,
  email,
  status
)
values
  (
    'yassine_enib',
    'Yassine Ben Salem',
    'staff',
    'ENIB',
    null,
    'yassine.bensalem@enib.ucar.tn',
    'available'
  ),
  (
    'director_enib',
    'Directeur de l''ENIB',
    'director',
    'ENIB',
    null,
    'direction@enib.ucar.tn',
    'out_of_office'
  ),
  (
    'dean_engineering',
    'Doyen du domaine Ingénierie',
    'dean',
    null,
    'engineering',
    'doyen.engineering@ucar.tn',
    'available'
  )
on conflict (id) do update
set name = excluded.name,
    role = excluded.role,
    institution_id = excluded.institution_id,
    domain = excluded.domain,
    email = excluded.email,
    status = excluded.status;

with enib as (
  select id
  from institutions
  where acronym = 'ENIB' or code = '431'
  order by acronym = 'ENIB' desc
  limit 1
)
delete from kpis
where institution_id = (select id from enib)
  and period = '2024-2025'
  and source = 'demo_multi_role_seed';

with enib as (
  select id
  from institutions
  where acronym = 'ENIB' or code = '431'
  order by acronym = 'ENIB' desc
  limit 1
)
insert into submissions (
  institution_id,
  period,
  status,
  submitted_at,
  domain
)
select
  id,
  '2024-2025',
  'pending',
  null,
  'esg'
from enib
on conflict (institution_id, period) do update
set status = 'pending',
    submitted_at = null,
    domain = 'esg';

with enib as (
  select id
  from institutions
  where acronym = 'ENIB' or code = '431'
  order by acronym = 'ENIB' desc
  limit 1
)
insert into kpis (
  institution_id,
  domain,
  metric,
  value,
  period,
  source
)
select enib.id, seed.domain, seed.metric, seed.value, seed.period, seed.source
from enib
cross join (
  values
    ('esg', 'energy_kwh', 4520.0, '2024-2025', 'demo_multi_role_seed'),
    ('esg', 'water_m3', 1280.0, '2024-2025', 'demo_multi_role_seed'),
    ('esg', 'waste_tons', 18.4, '2024-2025', 'demo_multi_role_seed'),
    ('esg', 'green_space_m2', 7300.0, '2024-2025', 'demo_multi_role_seed'),
    ('esg', 'recycling_rate_pct', 42.0, '2024-2025', 'demo_multi_role_seed'),
    ('esg', 'carbon_tons', 91.0, '2024-2025', 'demo_multi_role_seed')
) as seed(domain, metric, value, period, source);

with clock as (
  select current_simulated_date
  from app_settings
  where id = 'demo'
)
insert into tickets (
  id,
  institution_id,
  kind,
  title,
  description,
  status,
  escalation_level,
  current_owner_user_id,
  created_at,
  metadata
)
select
  '00000000-0000-4000-8000-000000000001',
  'ENIB',
  'missing_document',
  'ENIB · indicateur ESG 2024 manquant',
  'Soumission incomplète — 6/7 documents reçus',
  'open',
  'staff',
  'yassine_enib',
  current_simulated_date - interval '2 days',
  '{"period":"2024-2025","kpi_id":"esg_2024","demo":"multi-role","original_owner_user_id":"yassine_enib"}'::jsonb
from clock;

insert into ticket_messages (
  id,
  ticket_id,
  sender,
  sender_user_id,
  content,
  metadata
)
values (
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000001',
  'system',
  null,
  'Ticket créé par l''agent de validation',
  '{"demo":"multi-role"}'::jsonb
);

insert into notifications (
  id,
  user_id,
  role_target,
  scope_filter,
  type,
  payload,
  read
)
values (
  '00000000-0000-4000-8000-000000000003',
  'yassine_enib',
  'staff',
  '{"institution_id":"ENIB"}'::jsonb,
  'submission_incomplete',
  '{"ticket_id":"00000000-0000-4000-8000-000000000001","message":"1 document manquant","link":"/staff/tickets/00000000-0000-4000-8000-000000000001","demo":"multi-role"}'::jsonb,
  false
);
