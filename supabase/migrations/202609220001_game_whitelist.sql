create extension if not exists pgcrypto;

create table if not exists public.game_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  seed text not null,
  run_token_hash text not null,
  game_version text not null,
  viewport_width integer not null check (viewport_width between 320 and 7680),
  viewport_height integer not null check (viewport_height between 240 and 4320),
  mode text not null check (mode in ('desktop','mobile_landscape')),
  started_at timestamptz not null default clock_timestamp(),
  last_heartbeat_at timestamptz not null default clock_timestamp(),
  heartbeat_count integer not null default 0,
  last_heartbeat_sequence integer not null default 0,
  last_event_sequence integer not null default 0,
  client_elapsed double precision not null default 0,
  status text not null default 'active' check (status in ('active','completed','invalid','review','abandoned')),
  finished_at timestamptz,
  validated_survival_time double precision,
  suspicious_score integer not null default 0,
  suspicious_flags jsonb not null default '[]'::jsonb,
  final_result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists game_runs_one_active_user on public.game_runs(user_id) where status='active';
create index if not exists game_runs_user_created on public.game_runs(user_id,created_at desc);

create table if not exists public.game_events (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.game_runs(id) on delete cascade,
  sequence integer not null,
  event_type text not null check (event_type='jump'),
  game_time double precision not null check (game_time >= 0),
  received_at timestamptz not null default clock_timestamp(),
  unique(run_id,sequence)
);

create table if not exists public.reward_pools (
  tier text primary key check (tier in ('FCFS','GTD')),
  capacity integer not null check (capacity > 0),
  confirmed_count integer not null default 0 check (confirmed_count >= 0),
  updated_at timestamptz not null default now()
);
insert into public.reward_pools(tier,capacity) values ('FCFS',1500),('GTD',700)
on conflict(tier) do update set capacity=excluded.capacity;

create table if not exists public.reward_reservations (
  id uuid primary key default gen_random_uuid(),
  reservation_order bigint generated always as identity unique,
  run_id uuid not null references public.game_runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tier text not null references public.reward_pools(tier),
  threshold_crossed_at timestamptz not null,
  status text not null check (status in ('pending_validation','pending_capacity','confirmed','released','expired','invalid')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(run_id,tier)
);
create index if not exists reward_reservations_queue on public.reward_reservations(tier,status,threshold_crossed_at,reservation_order);
create unique index if not exists reward_one_active_user on public.reward_reservations(user_id)
where status in ('pending_validation','confirmed');

create table if not exists public.whitelist_eligibility (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null unique references public.game_runs(id),
  reservation_id uuid not null unique references public.reward_reservations(id),
  tier text not null check (tier in ('FCFS','GTD')),
  threshold_crossed_at timestamptz not null,
  verified_at timestamptz not null,
  status text not null default 'verified' check (status in ('verified','claimed','revoked')),
  wallet_address text,
  x_handle text,
  x_avatar_url text,
  share_url text,
  share_post_id text,
  share_status text not null default 'not_started' check (share_status in ('not_started','submitted')),
  shared_at timestamptz,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.whitelist_eligibility add column if not exists x_handle text;
alter table public.whitelist_eligibility add column if not exists x_avatar_url text;
alter table public.whitelist_eligibility add column if not exists share_url text;
alter table public.whitelist_eligibility add column if not exists share_post_id text;
alter table public.whitelist_eligibility add column if not exists share_status text not null default 'not_started';
alter table public.whitelist_eligibility add column if not exists shared_at timestamptz;
create unique index if not exists whitelist_one_user on public.whitelist_eligibility(user_id) where status in ('verified','claimed');
create unique index if not exists whitelist_one_wallet on public.whitelist_eligibility(lower(wallet_address)) where wallet_address is not null;
create unique index if not exists whitelist_one_share_post on public.whitelist_eligibility(share_post_id) where share_post_id is not null;

create table if not exists public.game_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  bucket timestamptz not null,
  request_count integer not null default 1,
  primary key(user_id,action,bucket)
);

alter table public.game_runs enable row level security;
alter table public.game_events enable row level security;
alter table public.reward_pools enable row level security;
alter table public.reward_reservations enable row level security;
alter table public.whitelist_eligibility enable row level security;
alter table public.game_rate_limits enable row level security;

create or replace function public.check_game_rate_limit(p_user_id uuid,p_action text,p_window_seconds integer,p_limit integer)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_bucket timestamptz; v_count integer;
begin
  v_bucket:=to_timestamp(floor(extract(epoch from clock_timestamp())/p_window_seconds)*p_window_seconds);
  insert into game_rate_limits(user_id,action,bucket,request_count) values(p_user_id,p_action,v_bucket,1)
  on conflict(user_id,action,bucket) do update set request_count=game_rate_limits.request_count+1
  returning request_count into v_count;
  return v_count<=p_limit;
end $$;

create or replace function public.game_availability()
returns jsonb language sql security definer set search_path=public as $$
  select jsonb_object_agg(tier, jsonb_build_object(
    'capacity',capacity,
    'confirmed',confirmed_count,
    'reserved',(select count(*) from reward_reservations r where r.tier=p.tier and r.status='pending_validation' and (r.expires_at is null or r.expires_at>clock_timestamp())),
    'remaining',greatest(0,capacity-confirmed_count-(select count(*) from reward_reservations r where r.tier=p.tier and r.status='pending_validation' and (r.expires_at is null or r.expires_at>clock_timestamp()))),
    'open',(confirmed_count+(select count(*) from reward_reservations r where r.tier=p.tier and r.status='pending_validation' and (r.expires_at is null or r.expires_at>clock_timestamp())))<capacity
  )) from reward_pools p;
$$;

create or replace function public.game_public_stats()
returns jsonb language sql security definer set search_path=public as $$
  select jsonb_build_object(
    'uniquePlayers',(select count(distinct user_id) from game_runs),
    'challengeAttempts',(select count(*) from game_runs),
    'availability',game_availability()
  );
$$;

create or replace function public.promote_reward_queue(p_tier text)
returns void language plpgsql security definer set search_path=public as $$
declare v_pool reward_pools%rowtype; v_used integer; v_next reward_reservations%rowtype; v_run game_runs%rowtype;
begin
  select * into v_pool from reward_pools where tier=p_tier for update;
  loop
    select v_pool.confirmed_count+count(*) into v_used from reward_reservations where tier=p_tier and status='pending_validation' and expires_at>clock_timestamp();
    exit when v_used>=v_pool.capacity;
    select * into v_next from reward_reservations where tier=p_tier and status='pending_capacity' order by threshold_crossed_at,reservation_order limit 1 for update skip locked;
    exit when not found;
    select * into v_run from game_runs where id=v_next.run_id for update;
    if v_run.status='completed' then
      update reward_reservations set status='confirmed',expires_at=null,updated_at=now() where id=v_next.id;
      update reward_pools set confirmed_count=confirmed_count+1,updated_at=now() where tier=p_tier;
      insert into whitelist_eligibility(user_id,run_id,reservation_id,tier,threshold_crossed_at,verified_at)
        values(v_next.user_id,v_next.run_id,v_next.id,p_tier,v_next.threshold_crossed_at,clock_timestamp()) on conflict do nothing;
      v_pool.confirmed_count:=v_pool.confirmed_count+1;
    elsif v_run.status='active' then
      update reward_reservations set status='pending_validation',expires_at=clock_timestamp()+interval '5 minutes',updated_at=now() where id=v_next.id;
    else
      update reward_reservations set status='released',updated_at=now() where id=v_next.id;
    end if;
  end loop;
end $$;

create or replace function public.expire_game_reservations()
returns void language plpgsql security definer set search_path=public as $$
begin
  update game_runs set status='abandoned',finished_at=clock_timestamp(),updated_at=now()
    where status='active' and last_heartbeat_at<clock_timestamp()-interval '5 minutes';
  update reward_reservations set status='expired',updated_at=now()
    where status='pending_validation' and expires_at<clock_timestamp();
  perform promote_reward_queue('GTD'); perform promote_reward_queue('FCFS');
end $$;

create or replace function public.reserve_game_reward(p_run_id uuid,p_user_id uuid,p_tier text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_run game_runs%rowtype; v_pool reward_pools%rowtype; v_threshold integer; v_used integer; v_status text; v_res reward_reservations%rowtype;
begin
  if p_tier not in ('FCFS','GTD') then raise exception 'invalid_tier'; end if;
  update reward_reservations set status='expired',updated_at=now() where tier=p_tier and status='pending_validation' and expires_at<clock_timestamp();
  v_threshold:=case when p_tier='GTD' then 60 else 45 end;
  select * into v_run from game_runs where id=p_run_id and user_id=p_user_id for update;
  if not found or v_run.status<>'active' then raise exception 'run_not_active'; end if;
  if extract(epoch from (clock_timestamp()-v_run.started_at))<v_threshold then
    update game_runs set suspicious_score=suspicious_score+2,suspicious_flags=suspicious_flags||jsonb_build_array('early_'||lower(p_tier)),updated_at=now() where id=p_run_id;
    raise exception 'threshold_too_early';
  end if;
  select * into v_res from reward_reservations where run_id=p_run_id and tier=p_tier;
  if found then return jsonb_build_object('qualification',p_tier,'status',v_res.status,'positionTimestamp',v_res.threshold_crossed_at,'availability',game_availability()); end if;
  select * into v_pool from reward_pools where tier=p_tier for update;
  select count(*) into v_used from reward_reservations where tier=p_tier and status='pending_validation' and (expires_at is null or expires_at>clock_timestamp());
  v_used:=v_used+v_pool.confirmed_count;
  v_status:=case when v_used<v_pool.capacity then 'pending_validation' else 'pending_capacity' end;
  if p_tier='GTD' and v_status='pending_validation' then
    update reward_reservations set status='released',updated_at=now() where run_id=p_run_id and tier='FCFS' and status='pending_validation';
    perform promote_reward_queue('FCFS');
  end if;
  insert into reward_reservations(run_id,user_id,tier,threshold_crossed_at,status,expires_at)
  values(p_run_id,p_user_id,p_tier,clock_timestamp(),v_status,clock_timestamp()+interval '5 minutes') returning * into v_res;
  return jsonb_build_object('qualification',p_tier,'status',v_status,'positionTimestamp',v_res.threshold_crossed_at,'availability',game_availability());
end $$;

create or replace function public.finalize_game_run(p_run_id uuid,p_user_id uuid,p_valid boolean,p_survival double precision,p_flags jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_run game_runs%rowtype; v_res reward_reservations%rowtype; v_existing jsonb; v_pool reward_pools%rowtype;
begin
  select * into v_run from game_runs where id=p_run_id and user_id=p_user_id for update;
  if not found then raise exception 'run_not_found'; end if;
  if v_run.status<>'active' then return coalesce(v_run.final_result,jsonb_build_object('status',v_run.status)); end if;
  update game_runs set status=case when p_valid then 'completed' else 'invalid' end,finished_at=clock_timestamp(),validated_survival_time=p_survival,suspicious_flags=suspicious_flags||coalesce(p_flags,'[]'),updated_at=now() where id=p_run_id;
  if not p_valid then
    update reward_reservations set status='invalid',updated_at=now() where run_id=p_run_id and status in ('pending_validation','pending_capacity');
    perform promote_reward_queue('GTD'); perform promote_reward_queue('FCFS');
  else
    select * into v_res from reward_reservations where run_id=p_run_id and status='pending_validation' order by case tier when 'GTD' then 0 else 1 end limit 1 for update;
    if found then
      select * into v_pool from reward_pools where tier=v_res.tier for update;
      update reward_reservations set status='confirmed',expires_at=null,updated_at=now() where id=v_res.id;
      update reward_pools set confirmed_count=confirmed_count+1,updated_at=now() where tier=v_res.tier and confirmed_count<capacity;
      insert into whitelist_eligibility(user_id,run_id,reservation_id,tier,threshold_crossed_at,verified_at)
      values(p_user_id,p_run_id,v_res.id,v_res.tier,v_res.threshold_crossed_at,clock_timestamp()) on conflict do nothing;
    end if;
  end if;
  v_existing:=jsonb_build_object('status',case when p_valid then 'verified' else 'invalid' end,'tier',v_res.tier,'survivalTime',p_survival,'availability',game_availability());
  update game_runs set final_result=v_existing where id=p_run_id;
  return v_existing;
end $$;

revoke all on all tables in schema public from anon,authenticated;
grant execute on function public.game_availability() to anon,authenticated;

create or replace function public.start_game_run(p_user_id uuid,p_seed text,p_token_hash text,p_game_version text,p_width integer,p_height integer,p_mode text)
returns game_runs language plpgsql security definer set search_path=public as $$
declare v_run game_runs%rowtype;
begin
  update reward_reservations set status='released',updated_at=now()
    where run_id in (select id from game_runs where user_id=p_user_id and status='active') and status='pending_validation';
  update game_runs set status='abandoned',finished_at=clock_timestamp(),updated_at=now() where user_id=p_user_id and status='active';
  perform promote_reward_queue('GTD'); perform promote_reward_queue('FCFS');
  insert into game_runs(user_id,seed,run_token_hash,game_version,viewport_width,viewport_height,mode)
    values(p_user_id,p_seed,p_token_hash,p_game_version,p_width,p_height,p_mode) returning * into v_run;
  return v_run;
end $$;

create or replace function public.record_game_heartbeat(p_run_id uuid,p_user_id uuid,p_token_hash text,p_sequence integer,p_client_elapsed double precision,p_events jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_run game_runs%rowtype; v_event jsonb; v_seq integer; v_time double precision; v_server_elapsed double precision; v_flags jsonb='[]'::jsonb;
begin
  select * into v_run from game_runs where id=p_run_id and user_id=p_user_id for update;
  if not found or v_run.status<>'active' or v_run.run_token_hash<>p_token_hash then raise exception 'invalid_run'; end if;
  if p_sequence<=v_run.last_heartbeat_sequence then raise exception 'heartbeat_replay'; end if;
  v_server_elapsed:=extract(epoch from (clock_timestamp()-v_run.started_at));
  if p_client_elapsed>v_server_elapsed+3 then v_flags:=v_flags||'["client_time_ahead"]'::jsonb; end if;
  if p_sequence>v_run.last_heartbeat_sequence+3 then v_flags:=v_flags||'["heartbeat_gap"]'::jsonb; end if;
  for v_event in select * from jsonb_array_elements(coalesce(p_events,'[]'::jsonb)) loop
    v_seq:=(v_event->>'sequence')::integer; v_time:=(v_event->>'gameTime')::double precision;
    if v_seq<=v_run.last_event_sequence or v_time<0 or v_time>v_server_elapsed+1 then raise exception 'invalid_event_sequence'; end if;
    insert into game_events(run_id,sequence,event_type,game_time) values(p_run_id,v_seq,'jump',v_time);
    v_run.last_event_sequence:=v_seq;
  end loop;
  update game_runs set last_heartbeat_at=clock_timestamp(),heartbeat_count=heartbeat_count+1,last_heartbeat_sequence=p_sequence,
    last_event_sequence=v_run.last_event_sequence,client_elapsed=p_client_elapsed,suspicious_score=suspicious_score+jsonb_array_length(v_flags),
    suspicious_flags=suspicious_flags||v_flags,updated_at=now() where id=p_run_id;
  update reward_reservations set expires_at=clock_timestamp()+interval '5 minutes',updated_at=now() where run_id=p_run_id and status='pending_validation';
  return jsonb_build_object('serverElapsed',v_server_elapsed,'flags',v_flags,'availability',game_availability());
end $$;

revoke execute on function public.start_game_run(uuid,text,text,text,integer,integer,text) from public,anon,authenticated;
revoke execute on function public.record_game_heartbeat(uuid,uuid,text,integer,double precision,jsonb) from public,anon,authenticated;
revoke execute on function public.reserve_game_reward(uuid,uuid,text) from public,anon,authenticated;
revoke execute on function public.finalize_game_run(uuid,uuid,boolean,double precision,jsonb) from public,anon,authenticated;
grant execute on function public.start_game_run(uuid,text,text,text,integer,integer,text) to service_role;
grant execute on function public.record_game_heartbeat(uuid,uuid,text,integer,double precision,jsonb) to service_role;
grant execute on function public.reserve_game_reward(uuid,uuid,text) to service_role;
grant execute on function public.finalize_game_run(uuid,uuid,boolean,double precision,jsonb) to service_role;
revoke execute on function public.promote_reward_queue(text) from public,anon,authenticated;
revoke execute on function public.expire_game_reservations() from public,anon,authenticated;
revoke execute on function public.check_game_rate_limit(uuid,text,integer,integer) from public,anon,authenticated;
revoke execute on function public.game_public_stats() from public,anon,authenticated;
grant execute on function public.expire_game_reservations() to service_role;
grant execute on function public.check_game_rate_limit(uuid,text,integer,integer) to service_role;
grant execute on function public.game_public_stats() to service_role;

create or replace function public.award_verified_game_reward(p_run_id uuid,p_user_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_run game_runs%rowtype; v_existing whitelist_eligibility%rowtype; v_new_res reward_reservations%rowtype; v_pool reward_pools%rowtype; v_tier text; v_threshold integer;
begin
  select * into v_run from game_runs where id=p_run_id and user_id=p_user_id for update;
  if not found or v_run.status<>'completed' or v_run.validated_survival_time is null then raise exception 'run_not_verified'; end if;
  v_tier:=case when v_run.validated_survival_time>=60 then 'GTD' when v_run.validated_survival_time>=45 then 'FCFS' else null end;
  select * into v_existing from whitelist_eligibility where user_id=p_user_id and status in ('verified','claimed') for update;
  if v_existing.tier='GTD' or (v_existing.tier='FCFS' and v_tier is distinct from 'GTD') then return jsonb_build_object('status','verified','tier',v_existing.tier,'survivalTime',v_run.validated_survival_time,'availability',game_availability()); end if;
  if v_tier is null then return jsonb_build_object('status','verified','tier',null,'survivalTime',v_run.validated_survival_time,'availability',game_availability()); end if;
  select * into v_pool from reward_pools where tier=v_tier for update;
  if v_pool.confirmed_count>=v_pool.capacity then return jsonb_build_object('status','verified','tier',v_existing.tier,'survivalTime',v_run.validated_survival_time,'availability',game_availability()); end if;
  v_threshold:=case when v_tier='GTD' then 60 else 45 end;
  if v_existing.id is not null then
    update reward_reservations set status='released',updated_at=clock_timestamp() where id=v_existing.reservation_id;
    update reward_pools set confirmed_count=greatest(0,confirmed_count-1),updated_at=clock_timestamp() where tier=v_existing.tier;
  end if;
  insert into reward_reservations(run_id,user_id,tier,threshold_crossed_at,status,expires_at) values(p_run_id,p_user_id,v_tier,v_run.started_at+make_interval(secs=>v_threshold),'confirmed',null)
  on conflict(run_id,tier) do update set status='confirmed',expires_at=null,updated_at=clock_timestamp() returning * into v_new_res;
  update reward_pools set confirmed_count=confirmed_count+1,updated_at=clock_timestamp() where tier=v_tier;
  if v_existing.id is null then
    insert into whitelist_eligibility(user_id,run_id,reservation_id,tier,threshold_crossed_at,verified_at) values(p_user_id,p_run_id,v_new_res.id,v_tier,v_new_res.threshold_crossed_at,clock_timestamp());
  else
    update whitelist_eligibility set run_id=p_run_id,reservation_id=v_new_res.id,tier=v_tier,threshold_crossed_at=v_new_res.threshold_crossed_at,verified_at=clock_timestamp(),status='verified',wallet_address=null,share_url=null,share_post_id=null,share_status='not_started',shared_at=null,claimed_at=null where id=v_existing.id;
  end if;
  return jsonb_build_object('status','verified','tier',v_tier,'survivalTime',v_run.validated_survival_time,'availability',game_availability());
end $$;
revoke execute on function public.award_verified_game_reward(uuid,uuid) from public,anon,authenticated;
grant execute on function public.award_verified_game_reward(uuid,uuid) to service_role;
