-- Chance app data schema. Applied to Supabase on 2026-11-03.
-- Do not run against another project unless explicitly authorized.
-- This file contains no customer data and no secret/API keys.
create table if not exists public.chance_documents (
 user_id uuid not null references auth.users(id) on delete cascade,
 app_slug text not null check (app_slug in ('invoice-proof', 'custom-order-payments', 'carton-inventory', 'saas-renewal-audit', 'filter-service', 'chargeback-evidence', 'contract-work-orders', 'shortstay-profit', 'parking-roi', 'laundry-payback')),
 records jsonb not null default '[]'::jsonb,
 version integer not null default 1 check(version>=1),
 updated_at timestamptz not null default now(),
 primary key (user_id, app_slug),
 constraint chance_documents_records_array check (jsonb_typeof(records)='array'),
 constraint chance_documents_records_limit check (jsonb_array_length(records)<=5000),
 constraint chance_documents_bytes_limit check (pg_column_size(records)<=2097152)
);
alter table public.chance_documents enable row level security;
revoke all on public.chance_documents from public, anon, authenticated;
grant select, insert, update, delete on public.chance_documents to authenticated;

create table if not exists public.chance_trial_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 app_slug text not null check (app_slug in ('invoice-proof', 'custom-order-payments', 'carton-inventory', 'saas-renewal-audit', 'filter-service', 'chargeback-evidence', 'contract-work-orders', 'shortstay-profit', 'parking-roi', 'laundry-payback')),
 plan_name text not null default '付費試用',
 note text not null default '' check(char_length(note)<=1200),
 status text not null default 'new' check(status in ('new','contacted','closed')),
 created_at timestamptz not null default now()
);
create unique index if not exists chance_trial_requests_one_open_per_app
 on public.chance_trial_requests(user_id,app_slug) where status='new';
create index if not exists chance_trial_requests_created_idx
 on public.chance_trial_requests(created_at desc);
alter table public.chance_trial_requests enable row level security;
revoke all on public.chance_trial_requests from public, anon, authenticated;
grant select, insert on public.chance_trial_requests to authenticated;

-- Idempotent policies, safe on databases already migrated.
do $migration$
begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='chance_documents' and policyname='chance_documents_owner_select') then
   create policy chance_documents_owner_select on public.chance_documents
     for select to authenticated using (user_id = (select auth.uid()));
 end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='chance_documents' and policyname='chance_documents_owner_insert') then
   create policy chance_documents_owner_insert on public.chance_documents
     for insert to authenticated with check (user_id = (select auth.uid()));
 end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='chance_documents' and policyname='chance_documents_owner_update') then
   create policy chance_documents_owner_update on public.chance_documents
     for update to authenticated using (user_id = (select auth.uid()))
     with check (user_id = (select auth.uid()));
 end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='chance_documents' and policyname='chance_documents_owner_delete') then
   create policy chance_documents_owner_delete on public.chance_documents
     for delete to authenticated using (user_id = (select auth.uid()));
 end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='chance_trial_requests' and policyname='chance_trial_requests_owner_select') then
   create policy chance_trial_requests_owner_select on public.chance_trial_requests
     for select to authenticated using (user_id = (select auth.uid()));
 end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='chance_trial_requests' and policyname='chance_trial_requests_owner_insert') then
   create policy chance_trial_requests_owner_insert on public.chance_trial_requests
     for insert to authenticated with check (user_id = (select auth.uid()) and status='new' and char_length(note)<=1200);
 end if;
end $migration$;
