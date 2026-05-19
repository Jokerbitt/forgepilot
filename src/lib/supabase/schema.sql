-- ════════════════════════════════════════════════════════════════════════
-- ForgePilot — Supabase Schema
-- Run once in your Supabase SQL Editor to set up all tables.
--
-- EU data residency: select "eu-central-1" (Frankfurt) when creating
-- your Supabase project for DSGVO compliance.
-- ════════════════════════════════════════════════════════════════════════

-- Enable pgvector for semantic search (Knowledge Center + Context Engineering)
create extension if not exists vector;

-- ═══════════════════════════════════════════════════════
-- CORE TABLES (replace JSON files)
-- ═══════════════════════════════════════════════════════

-- Delegations (replaces config/delegations.json)
create table if not exists delegations (
  id                  text primary key,
  title               text,
  status              text not null default 'pending',
  contract            jsonb not null default '{}',
  logs                jsonb not null default '[]',
  summary_report      jsonb,
  actual_cost_usd     numeric(10,6),
  execution_route     text,
  auto_orchestrate    boolean default false,
  -- DSGVO fields
  data_subject_id     text,
  privacy_class       text default 'internal',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists delegations_status_idx on delegations(status);
create index if not exists delegations_created_idx on delegations(created_at desc);

-- Orchestrated Runs (replaces config/orchestrated-runs.json)
create table if not exists orchestrated_runs (
  id                    text primary key,
  delegation_id         text references delegations(id) on delete cascade,
  delegation_title      text not null,
  goal                  text not null,
  status                text not null default 'planning',
  tasks                 jsonb not null default '[]',
  overall_quality_score int,
  max_retries           int not null default 2,
  current_task_index    int not null default 0,
  completed_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists orch_runs_status_idx on orchestrated_runs(status);
create index if not exists orch_runs_delegation_idx on orchestrated_runs(delegation_id);

-- Notifications (replaces config/notifications.json)
create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  type        text not null,
  severity    text not null default 'info',
  title       text not null,
  body        text,
  link        text,
  source_id   text,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists notifs_read_idx  on notifications(read);
create index if not exists notifs_time_idx  on notifications(created_at desc);

-- Work Items (replaces config/local-items.json)
create table if not exists work_items (
  id              text primary key,
  source          text not null default 'local',
  type            text not null default 'ticket',
  title           text not null,
  url             text not null default '',
  project_id      text,
  status          text not null default 'todo',
  priority        smallint not null default 1,
  blocked         boolean not null default false,
  risk            text not null default 'A',
  ai_delegable    boolean not null default false,
  estimated_minutes int,
  cost_estimate_usd numeric(8,4),
  metadata        jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════
-- KNOWLEDGE CENTER (with pgvector)
-- ═══════════════════════════════════════════════════════

-- Knowledge Cards (replaces config/knowledge-store.json cards[])
create table if not exists knowledge_cards (
  id            text primary key,
  type          text not null,
  title         text not null,
  body          text not null,
  tags          text[] not null default '{}',
  privacy_class text not null default 'internal',
  confidence    text not null default 'medium',
  source_ids    text[] not null default '{}',
  -- pgvector: 1536 dims for OpenAI/Gemini embeddings, 768 for smaller models
  embedding     vector(1536),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- IVFFlat index for fast approximate nearest-neighbor search
create index if not exists knowledge_embedding_idx
  on knowledge_cards using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists knowledge_tags_idx on knowledge_cards using gin(tags);

-- Semantic search function (called from Context Engineer)
create or replace function match_knowledge_cards(
  query_embedding vector(1536),
  match_threshold float default 0.75,
  match_count     int   default 5
)
returns table (
  id            text,
  title         text,
  body          text,
  tags          text[],
  similarity    float
)
language sql stable
as $$
  select
    id, title, body, tags,
    1 - (embedding <=> query_embedding) as similarity
  from knowledge_cards
  where 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- ═══════════════════════════════════════════════════════
-- EVAL HARNESS
-- ═══════════════════════════════════════════════════════

create table if not exists eval_cases (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  prompt              text not null,
  skill_category      text,
  acceptance_criteria text[] not null default '{}',
  golden_output       text,
  tags                text[] not null default '{}',
  active              boolean not null default true,
  created_at          timestamptz not null default now()
);

create table if not exists eval_results (
  id                uuid primary key default gen_random_uuid(),
  case_id           uuid references eval_cases(id) on delete cascade,
  delegation_id     text references delegations(id) on delete set null,
  run_id            text references orchestrated_runs(id) on delete set null,
  -- 3-Dimensionen-Score
  correctness_score int,    -- 0-100: Acceptance criteria hit rate
  efficiency_score  int,    -- 0-100: tokens/quality ratio
  drift_score       int,    -- 0-100: scope creep penalty (100 = no drift)
  overall_grade     text,   -- A|B|C|D|F
  criteria_hit      boolean[] not null default '{}',
  tokens_used       int,
  cost_usd          numeric(8,6),
  regression        boolean not null default false,
  prompt_variant    text,   -- for A/B testing
  provider_id       text,
  model_id          text,
  evaluated_at      timestamptz not null default now()
);

create index if not exists eval_results_case_idx on eval_results(case_id, evaluated_at desc);

-- Regression alerts
create table if not exists eval_alerts (
  id              uuid primary key default gen_random_uuid(),
  case_id         uuid references eval_cases(id) on delete cascade,
  previous_grade  text,
  current_grade   text,
  score_delta     int,
  acknowledged    boolean not null default false,
  created_at      timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════
-- DSGVO / GDPR COMPLIANCE
-- ═══════════════════════════════════════════════════════

-- Art. 30 DSGVO: Verarbeitungsverzeichnis (Processing Record)
create table if not exists processing_ledger (
  id              uuid primary key default gen_random_uuid(),
  purpose         text not null,
  data_types      text[] not null default '{}',
  processor       text not null,
  legal_basis     text not null default 'legitimate-interest',
  data_subject_id text,
  pii_detected    boolean not null default false,
  pii_categories  text[] not null default '{}',
  pii_redacted    boolean not null default false,
  pii_count       int not null default 0,
  data_residency  text not null default 'unknown',
  provider_id     text,
  model_id        text,
  input_tokens    int,
  retention_days  int not null default 365,
  processed_at    timestamptz not null default now(),
  delete_after    timestamptz generated always as
                  (processed_at + (retention_days || ' days')::interval) stored
);

create index if not exists ledger_time_idx   on processing_ledger(processed_at desc);
create index if not exists ledger_subject_idx on processing_ledger(data_subject_id);
create index if not exists ledger_delete_idx  on processing_ledger(delete_after);

-- Data subjects (for Right to Erasure, Art. 17)
create table if not exists data_subjects (
  id                    uuid primary key default gen_random_uuid(),
  external_id           text unique not null,
  email_hash            text,  -- SHA-256 of email, never plaintext
  created_at            timestamptz not null default now(),
  erasure_requested_at  timestamptz,
  erased_at             timestamptz
);

-- PII scan results
create table if not exists pii_scan_results (
  id            uuid primary key default gen_random_uuid(),
  ledger_id     uuid references processing_ledger(id) on delete cascade,
  pattern_type  text not null,
  occurrences   int not null default 0,
  redacted      boolean not null default true,
  scanned_at    timestamptz not null default now()
);

-- Retention policies (configurable per data type)
create table if not exists retention_policies (
  data_type       text primary key,
  retention_days  int not null,
  legal_basis     text,
  description     text,
  last_cleanup_at timestamptz
);

-- Default retention policies (DSGVO-recommended minimums)
insert into retention_policies (data_type, retention_days, legal_basis, description) values
  ('delegation',        365,  'legitimate-interest', 'Agent-Delegationen'),
  ('orchestrated_run',  365,  'legitimate-interest', 'Orchestrierungs-Runs'),
  ('notification',       90,  'legitimate-interest', 'Inbox-Benachrichtigungen'),
  ('eval_result',       730,  'legitimate-interest', 'Evaluierungsergebnisse'),
  ('processing_ledger', 1825, 'legal-obligation',    'Art. 30 DSGVO — 5 Jahre Aufbewahrungspflicht'),
  ('work_item',         365,  'legitimate-interest', 'Work Items')
on conflict (data_type) do nothing;

-- ═══════════════════════════════════════════════════════
-- REALTIME (enable for relevant tables)
-- ═══════════════════════════════════════════════════════

-- Enable Realtime publications
-- Run in Supabase Dashboard → Database → Publications → supabase_realtime
-- Or via SQL:
alter publication supabase_realtime add table orchestrated_runs;
alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table delegations;

-- ═══════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (enable for multi-user setups)
-- ═══════════════════════════════════════════════════════
-- Uncomment when you add authentication:
-- alter table delegations         enable row level security;
-- alter table orchestrated_runs   enable row level security;
-- alter table notifications       enable row level security;
-- alter table processing_ledger   enable row level security;
