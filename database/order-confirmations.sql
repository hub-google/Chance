-- Chance: customer-specific custom-order specification confirmation (2026-11-04)
-- The token is returned once to the authenticated owner. Only its SHA-256 digest is stored.
-- No changes to auth users, other applications, payment or shared tables.
begin;

create table if not exists public.chance_order_confirmations (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 record_id text not null check (char_length(record_id) between 1 and 150),
 token_hash text not null unique check (char_length(token_hash)=64),
 snapshot jsonb not null check (jsonb_typeof(snapshot)='object' and pg_column_size(snapshot)<=8192),
 status text not null default 'pending' check (status in ('pending','confirmed','declined','revoked')),
 response_note text not null default '' check (char_length(response_note)<=500),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '7 days'),
 responded_at timestamptz,
 constraint chance_confirm_time_check check (expires_at>created_at)
);
create index if not exists chance_order_confirmations_owner_idx
 on public.chance_order_confirmations (owner_id,created_at desc);
alter table public.chance_order_confirmations enable row level security;
revoke all on public.chance_order_confirmations from public,anon,authenticated;
grant select on public.chance_order_confirmations to authenticated;
do $policy$
begin
 if not exists (select 1 from pg_policies where schemaname='public' and tablename='chance_order_confirmations' and policyname='chance_order_confirmations_owner_read') then
  create policy chance_order_confirmations_owner_read on public.chance_order_confirmations
   for select to authenticated using (owner_id=(select auth.uid()));
 end if;
end $policy$;

create or replace function public.chance_create_order_confirmation(
 p_record_id text,p_order text,p_client text,p_specs text,p_total numeric
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $func$
declare
 v_owner uuid:=auth.uid();
 v_token text;
 v_id uuid;
 v_expires timestamptz;
begin
 if v_owner is null then raise exception '需先登入 Chance 帳號';end if;
 if p_record_id is null or char_length(trim(p_record_id)) not between 1 and 150
 or p_order is null or char_length(trim(p_order)) not between 1 and 140
 or p_specs is null or char_length(trim(p_specs)) not between 10 and 2000
 or p_client is null or char_length(trim(p_client))>140
 or p_total is null or p_total<0 or p_total>1000000000000 then
  raise exception '請填寫有效訂單編號、規格摘要與金額';
 end if;
 if (select count(*) from public.chance_order_confirmations where owner_id=v_owner)>=200 then
  raise exception '已達 200 筆確認邀請上限，請聯繫管理員處理';
 end if;
 update public.chance_order_confirmations
 set status='revoked'
 where owner_id=v_owner and record_id=trim(p_record_id) and status='pending';
 v_token=encode(extensions.gen_random_bytes(24),'hex');
 insert into public.chance_order_confirmations(owner_id,record_id,token_hash,snapshot)
 values(v_owner,trim(p_record_id),encode(extensions.digest(v_token,'sha256'),'hex'),
  jsonb_build_object('order',trim(p_order),'client',trim(p_client),'specs',trim(p_specs),'total',p_total))
 returning id,expires_at into v_id,v_expires;
 return jsonb_build_object('ok',true,'id',v_id,'token',v_token,'expires_at',v_expires);
end $func$;

create or replace function public.chance_order_confirmation_preview(p_token text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $func$
declare v_record public.chance_order_confirmations%rowtype;
begin
 if p_token is null or p_token !~ '^[a-f0-9]{48}$' then
  return jsonb_build_object('ok',false,'status','invalid');
 end if;
 select * into v_record from public.chance_order_confirmations
 where token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
 limit 1;
 if not found or v_record.status='revoked' then
  return jsonb_build_object('ok',false,'status','invalid');
 end if;
 if v_record.expires_at<=now() then
  return jsonb_build_object('ok',false,'status','expired');
 end if;
 return jsonb_build_object('ok',true,'status',v_record.status,
  'snapshot',v_record.snapshot,'expires_at',v_record.expires_at,
  'responded_at',v_record.responded_at);
end $func$;

create or replace function public.chance_order_confirmation_reply(
 p_token text,p_decision text,p_feedback text default ''
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $func$
declare v_id uuid;
begin
 if p_token is null or p_token !~ '^[a-f0-9]{48}$'
 or p_decision is null or p_decision not in ('confirmed','declined')
 or p_feedback is null or char_length(p_feedback)>500 then
  return jsonb_build_object('ok',false,'status','invalid');
 end if;
 update public.chance_order_confirmations
 set status=p_decision,response_note=trim(p_feedback),responded_at=now()
 where token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
   and status='pending' and expires_at>now()
 returning id into v_id;
 if v_id is null then return jsonb_build_object('ok',false,'status','expired_or_used');end if;
 return jsonb_build_object('ok',true,'status',p_decision);
end $func$;

create or replace function public.chance_revoke_order_confirmation(p_id uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog as $func$
declare v_owner uuid:=auth.uid();
begin
 if v_owner is null then raise exception '請先登入';end if;
 update public.chance_order_confirmations set status='revoked'
 where id=p_id and owner_id=v_owner and status='pending';
 return found;
end $func$;

revoke all on function public.chance_create_order_confirmation(text,text,text,text,numeric) from public,anon,authenticated;
revoke all on function public.chance_order_confirmation_preview(text) from public,anon,authenticated;
revoke all on function public.chance_order_confirmation_reply(text,text,text) from public,anon,authenticated;
revoke all on function public.chance_revoke_order_confirmation(uuid) from public,anon,authenticated;
grant execute on function public.chance_create_order_confirmation(text,text,text,text,numeric) to authenticated;
grant execute on function public.chance_revoke_order_confirmation(uuid) to authenticated;
-- Intentional public capability: only a 192-bit random token reveals its minimal snapshot.
grant execute on function public.chance_order_confirmation_preview(text) to anon,authenticated;
grant execute on function public.chance_order_confirmation_reply(text,text,text) to anon,authenticated;

commit;
