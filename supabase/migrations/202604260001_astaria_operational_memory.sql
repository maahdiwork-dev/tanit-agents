create extension if not exists "uuid-ossp";

create table if not exists astaria_decisions (
  id uuid primary key default uuid_generate_v4(),
  proposal_id uuid,
  action_id text,
  decision text not null,
  rationale text,
  decided_by text default 'Pr. Nadia Mzoughi Aguir',
  created_at timestamptz default now()
);

create table if not exists astaria_proposals (
  id uuid primary key default uuid_generate_v4(),
  action_id text not null,
  status text not null default 'pending',
  situation text,
  proposed_action text,
  expected_impact_pts integer,
  estimated_cost_tnd integer,
  estimated_timeline text,
  risks jsonb,
  recommendation text,
  created_at timestamptz default now(),
  resolved_at timestamptz
);

create table if not exists astaria_mission_state (
  id uuid primary key default uuid_generate_v4(),
  action_id text unique not null,
  phase integer,
  status text not null default 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  notes text,
  current_progress_pct integer default 0,
  expected_points integer,
  captured_points integer default 0,
  updated_at timestamptz default now()
);

create table if not exists astaria_conversations (
  id uuid primary key default uuid_generate_v4(),
  thread_id text,
  summary text not null,
  duration_minutes integer,
  register text,
  outcomes jsonb,
  decisions_referenced uuid[],
  created_at timestamptz default now()
);

create index if not exists idx_astaria_proposals_status on astaria_proposals(status);
create index if not exists idx_astaria_mission_status on astaria_mission_state(status);
create index if not exists idx_astaria_conversations_created on astaria_conversations(created_at desc);

insert into astaria_mission_state (
  action_id,
  phase,
  status,
  started_at,
  completed_at,
  notes,
  current_progress_pct,
  expected_points,
  captured_points,
  updated_at
)
values
  (
    'P1.1',
    1,
    'blocked',
    null,
    null,
    'Décret rédigé. En attente de signature présidentielle depuis 2026-03-29. Blocker actif: décision requise.',
    0,
    200,
    0,
    '2026-04-26 09:00:00+01'
  ),
  (
    'P1.2',
    1,
    'in_progress',
    '2026-03-15 09:00:00+01',
    null,
    '18 / 33 établissements équipés. Reste 15. Livraison fournisseur prévue avant fin avril.',
    55,
    150,
    0,
    '2026-04-26 09:00:00+01'
  ),
  (
    'P1.3',
    1,
    'completed',
    '2026-02-01 09:00:00+01',
    '2026-04-15 09:00:00+01',
    'Cycle Q1 de tests de qualité de l''eau terminé. Premier rapport publié. +150 points WR.5 capturés.',
    100,
    150,
    150,
    '2026-04-26 09:00:00+01'
  ),
  (
    'P1.4',
    1,
    'pending',
    null,
    null,
    'Proposition de formalisation de la cellule prête. En attente de décision présidentielle.',
    0,
    30,
    0,
    '2026-04-26 09:00:00+01'
  ),
  (
    'P1.5',
    1,
    'in_progress',
    '2026-04-01 09:00:00+01',
    null,
    '8 / 33 campus cartographiés. Prestataire OpenStreetMap engagé.',
    24,
    100,
    0,
    '2026-04-26 09:00:00+01'
  ),
  (
    'P2.1',
    2,
    'pending',
    null,
    null,
    'Spécifications techniques prêtes. Appel d''offres à lancer.',
    0,
    100,
    0,
    '2026-04-26 09:00:00+01'
  ),
  (
    'P2.2',
    2,
    'pending',
    null,
    null,
    'Étude de faisabilité INSAT terminée le 2026-04-20. Résultat positif.',
    0,
    100,
    0,
    '2026-04-26 09:00:00+01'
  ),
  (
    'P2.3',
    2,
    'pending',
    null,
    null,
    '10 cafétérias pilotes identifiées: INSAT, IHEC, ENICarthage, ENIB, FSB, FSEGN, ENAU, EPT, FSJPS, ISLT.',
    0,
    200,
    0,
    '2026-04-26 09:00:00+01'
  ),
  (
    'P2.4',
    2,
    'pending',
    null,
    null,
    'Coordination avec clubs étudiants 3ZERO Campus prévue.',
    0,
    50,
    0,
    '2026-04-26 09:00:00+01'
  ),
  (
    'P2.5',
    2,
    'pending',
    null,
    null,
    'Trois prestataires e-déchets identifiés. Comparaison en cours.',
    0,
    200,
    0,
    '2026-04-26 09:00:00+01'
  ),
  (
    'P3.1',
    3,
    'pending',
    null,
    null,
    'Dépend de la Phase 2 livrée.',
    0,
    100,
    0,
    '2026-04-26 09:00:00+01'
  ),
  (
    'P3.2',
    3,
    'pending',
    null,
    null,
    'Méthodologie d''audit WS définie. À déclencher au mois 9.',
    0,
    100,
    0,
    '2026-04-26 09:00:00+01'
  ),
  (
    'P3.3',
    3,
    'pending',
    null,
    null,
    'Module de formation à concevoir. Astaria propose d''avancer cette action.',
    0,
    40,
    0,
    '2026-04-26 09:00:00+01'
  )
on conflict (action_id) do update set
  phase = excluded.phase,
  status = excluded.status,
  started_at = excluded.started_at,
  completed_at = excluded.completed_at,
  notes = excluded.notes,
  current_progress_pct = excluded.current_progress_pct,
  expected_points = excluded.expected_points,
  captured_points = excluded.captured_points,
  updated_at = excluded.updated_at;

insert into astaria_proposals (
  action_id,
  status,
  situation,
  proposed_action,
  expected_impact_pts,
  estimated_cost_tnd,
  estimated_timeline,
  risks,
  recommendation,
  created_at
)
select
  'P1.1',
  'pending',
  'The decree text is finalized. The benefit is clear (+200 points on WS.2, the highest-impact zero-cost action in Phase 1). The decree has been on Pr. Nadia''s desk pending signature for 4 weeks.',
  'Sign and publish the decree this week. UCAR communications team can publicize it within 48h. All 33 establishments receive notification. Implementation starts immediately.',
  200,
  0,
  '1 week from signature to operational',
  '["Some cafeterias will need 30-60 days to deplete inventory", "Limited pushback expected; students at IHEC 3ZERO Campus Club already advocate for this"]'::jsonb,
  'Approve. Highest leverage action in the entire plan.',
  '2026-03-29 09:00:00+01'
where not exists (
  select 1 from astaria_proposals
  where action_id = 'P1.1'
    and created_at = '2026-03-29 09:00:00+01'
);

insert into astaria_proposals (
  action_id,
  status,
  situation,
  proposed_action,
  expected_impact_pts,
  estimated_cost_tnd,
  estimated_timeline,
  risks,
  recommendation,
  created_at
)
select
  'P2.2',
  'pending',
  'INSAT feasibility study completed 2026-04-20 confirmed rooftop harvesting plus cistern model viability for INSAT, IHEC, ENICarthage, FSB, and FSEGN. Total catchment area: about 21,000 m². Annual collection estimate: 11,000 m³ greywater equivalent.',
  'Launch a pilot installation on the 5 institutions named above. Single procurement contract for cisterns, roof connectors and filtration. 6-month implementation timeline.',
  100,
  100000,
  '6 months from procurement to operational',
  '["Procurement timeline may extend if appel d''offres is contested", "Maintenance protocol needs ownership clarification"]'::jsonb,
  'Approve, with maintenance ownership clarification. Combined with P1.1, this gets UCAR a +300 point boost in Q2 2026.',
  '2026-04-26 09:00:00+01'
where not exists (
  select 1 from astaria_proposals
  where action_id = 'P2.2'
    and created_at = '2026-04-26 09:00:00+01'
);

insert into astaria_proposals (
  action_id,
  status,
  situation,
  proposed_action,
  expected_impact_pts,
  estimated_cost_tnd,
  estimated_timeline,
  risks,
  recommendation,
  created_at
)
select
  'P3.3',
  'pending',
  'The strategic plan placed training of the 33 GreenMetric référents in Phase 3, but advancing it to Phase 1 creates a multiplier effect on evidence collection.',
  'Identify and train one GreenMetric référent per institution starting next month. One-day workshop on the 54 indicators and evidence collection standards.',
  40,
  5000,
  '1 month preparation + 1-day delivery',
  '["Selecting the wrong person per institution could waste training"]'::jsonb,
  'Approve, with référent selection process. Worth advancing because it multiplies every action that follows.',
  '2026-04-26 09:05:00+01'
where not exists (
  select 1 from astaria_proposals
  where action_id = 'P3.3'
    and created_at = '2026-04-26 09:05:00+01'
);

insert into astaria_decisions (
  proposal_id,
  action_id,
  decision,
  rationale,
  created_at
)
select
  null,
  'P1.3',
  'approved',
  'Q2 water testing approved with internal-only publication for the first 6 months; public evaluation after the first year.',
  '2026-04-15 09:00:00+01'
where not exists (
  select 1 from astaria_decisions
  where action_id = 'P1.3'
    and created_at = '2026-04-15 09:00:00+01'
);

insert into astaria_decisions (
  proposal_id,
  action_id,
  decision,
  rationale,
  created_at
)
select
  null,
  'SOLAR-EXPANSION',
  'deferred',
  'Solar expansion beyond INSAT deferred until 12-month performance evaluation of INSAT panels.',
  '2026-03-22 09:00:00+01'
where not exists (
  select 1 from astaria_decisions
  where action_id = 'SOLAR-EXPANSION'
    and created_at = '2026-03-22 09:00:00+01'
);

insert into astaria_decisions (
  proposal_id,
  action_id,
  decision,
  rationale,
  created_at
)
select
  null,
  'P1.2',
  'approved',
  'Color-coded recycling bins approved with sequencing modification: start with the 5 largest institutions, then extend.',
  '2026-03-08 09:00:00+01'
where not exists (
  select 1 from astaria_decisions
  where action_id = 'P1.2'
    and created_at = '2026-03-08 09:00:00+01'
);

insert into astaria_decisions (
  proposal_id,
  action_id,
  decision,
  rationale,
  created_at
)
select
  null,
  'P1.3',
  'approved',
  'Quarterly water quality monitoring approved for the first cycle. Pr. Nadia framed it as: On ne peut pas améliorer ce qu''on ne mesure pas.',
  '2026-02-12 09:00:00+01'
where not exists (
  select 1 from astaria_decisions
  where action_id = 'P1.3'
    and created_at = '2026-02-12 09:00:00+01'
);

insert into astaria_decisions (
  proposal_id,
  action_id,
  decision,
  rationale,
  created_at
)
select
  null,
  'MISSION-LAUNCH',
  'approved',
  'Founding mandate confirmed: top 500 by end of 2027 as institutional GreenMetric target.',
  '2026-02-01 09:00:00+01'
where not exists (
  select 1 from astaria_decisions
  where action_id = 'MISSION-LAUNCH'
    and created_at = '2026-02-01 09:00:00+01'
);

insert into astaria_conversations (
  thread_id,
  summary,
  duration_minutes,
  register,
  outcomes,
  decisions_referenced,
  created_at
)
select
  'seed-2026-03-08-recycling-bins-decision',
  'Conversation on P1.2 recycling bins. Pr. Nadia pushed back on deploying all 33 institutions at once and approved a pilot-first sequence: 5 largest institutions, then extension. Astaria recorded that Pr. Nadia prefers pilots before universal rollout.',
  12,
  'présidentiel',
  '{"action_id":"P1.2","outcome":"approved with sequencing modification","pattern":"pilot-first framing"}'::jsonb,
  array[]::uuid[],
  '2026-03-08 09:30:00+01'
where not exists (
  select 1 from astaria_conversations
  where thread_id = 'seed-2026-03-08-recycling-bins-decision'
);

insert into astaria_conversations (
  thread_id,
  summary,
  duration_minutes,
  register,
  outcomes,
  decisions_referenced,
  created_at
)
select
  'seed-2026-04-15-water-testing-results',
  'Astaria named the Q1 water testing win: 31/33 institutions within standards, 2 follow-ups with remediation plans, and +150 WR.5 points captured. Pr. Nadia approved the Q2 cycle with internal-only publication for 6 months and public evaluation after one year.',
  8,
  'présidentiel -> warm',
  '{"action_id":"P1.3","outcome":"Q2 cycle approved","pattern":"quantified wins land well"}'::jsonb,
  array[]::uuid[],
  '2026-04-15 09:30:00+01'
where not exists (
  select 1 from astaria_conversations
  where thread_id = 'seed-2026-04-15-water-testing-results'
);
