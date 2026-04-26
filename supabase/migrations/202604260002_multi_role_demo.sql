-- Multi-role institutional demo backend.
-- Existing Tanit stores institutions.id as uuid; these demo tables keep the
-- contract-facing institution key (for example ENIB) as text and API code
-- resolves it to institutions.acronym/code/id when joining to existing data.

create extension if not exists pgcrypto;

alter table institutions
  add column if not exists domain text;

update institutions
set domain = 'engineering'
where acronym = 'ENIB'
   or code = '431'
   or name_fr ilike '%Ingénieurs de Bizerte%'
   or name_fr ilike '%Ingenieurs de Bizerte%';

create table if not exists app_settings (
  id text primary key default 'demo',
  current_simulated_date timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table app_settings
  add column if not exists current_simulated_date timestamptz not null default now();

insert into app_settings (id, current_simulated_date)
values ('demo', '2026-04-23T09:00:00Z')
on conflict (id) do nothing;

create table if not exists admin_staff_users (
  id text primary key,
  name text not null,
  role text not null check (role in ('staff', 'director', 'dean')),
  institution_id text,
  domain text,
  email text,
  status text not null default 'available'
    check (status in ('available', 'busy', 'out_of_office', 'on_mission')),
  created_at timestamptz not null default now()
);

create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  institution_id text not null,
  kind text not null
    check (kind in ('missing_document', 'invalid_data', 'escalation', 'manual_intervention')),
  title text not null,
  description text,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved', 'cancelled')),
  escalation_level text not null default 'staff'
    check (escalation_level in ('staff', 'director', 'dean', 'tanit')),
  current_owner_user_id text references admin_staff_users(id) on delete set null,
  created_at timestamptz not null default now(),
  escalated_at timestamptz,
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  sender text not null check (sender in ('staff', 'director', 'dean', 'tanit', 'system')),
  sender_user_id text references admin_staff_users(id) on delete set null,
  content text not null,
  attachment_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id text references admin_staff_users(id) on delete cascade,
  role_target text not null check (role_target in ('staff', 'director', 'dean', 'president')),
  scope_filter jsonb not null default '{}'::jsonb,
  type text not null
    check (type in (
      'submission_incomplete',
      'escalation_received',
      'tanit_wants_to_talk',
      'ticket_resolved',
      'mission_update'
    )),
  payload jsonb not null default '{}'::jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_staff_role on admin_staff_users(role);
create index if not exists idx_admin_staff_institution on admin_staff_users(institution_id);
create index if not exists idx_admin_staff_domain on admin_staff_users(domain);
create index if not exists idx_tickets_status on tickets(status);
create index if not exists idx_tickets_owner on tickets(current_owner_user_id);
create index if not exists idx_tickets_institution on tickets(institution_id);
create index if not exists idx_tickets_escalation on tickets(escalation_level);
create index if not exists idx_ticket_messages_ticket on ticket_messages(ticket_id);
create index if not exists idx_notifications_user on notifications(user_id);
create index if not exists idx_notifications_role on notifications(role_target);
create index if not exists idx_notifications_read on notifications(read);

alter table notifications replica identity full;
alter table tickets replica identity full;
alter table ticket_messages replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table notifications;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tickets'
  ) then
    alter publication supabase_realtime add table tickets;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ticket_messages'
  ) then
    alter publication supabase_realtime add table ticket_messages;
  end if;
end
$$;
