-- Keep this migration safe to run even when the earlier sharing-column update
-- has not yet been applied to an existing project.
alter table public.whitelist_eligibility add column if not exists x_handle text;
alter table public.whitelist_eligibility add column if not exists x_avatar_url text;
alter table public.whitelist_eligibility add column if not exists share_url text;
alter table public.whitelist_eligibility add column if not exists share_post_id text;
alter table public.whitelist_eligibility add column if not exists share_status text not null default 'not_started';
alter table public.whitelist_eligibility add column if not exists shared_at timestamptz;
create unique index if not exists whitelist_one_share_post on public.whitelist_eligibility(share_post_id) where share_post_id is not null;

create or replace function public.award_verified_game_reward(p_run_id uuid,p_user_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_run game_runs%rowtype;
  v_existing whitelist_eligibility%rowtype;
  v_old_res reward_reservations%rowtype;
  v_new_res reward_reservations%rowtype;
  v_pool reward_pools%rowtype;
  v_tier text;
  v_threshold integer;
begin
  select * into v_run from game_runs where id=p_run_id and user_id=p_user_id for update;
  if not found or v_run.status<>'completed' or v_run.validated_survival_time is null then raise exception 'run_not_verified'; end if;

  v_tier:=case when v_run.validated_survival_time>=60 then 'GTD' when v_run.validated_survival_time>=45 then 'FCFS' else null end;
  select * into v_existing from whitelist_eligibility where user_id=p_user_id and status in ('verified','claimed') for update;
  if v_existing.tier='GTD' or (v_existing.tier='FCFS' and v_tier is distinct from 'GTD') then
    return jsonb_build_object('status','verified','tier',v_existing.tier,'survivalTime',v_run.validated_survival_time,'availability',game_availability());
  end if;
  if v_tier is null then
    return jsonb_build_object('status','verified','tier',null,'survivalTime',v_run.validated_survival_time,'availability',game_availability());
  end if;

  select * into v_pool from reward_pools where tier=v_tier for update;
  if v_pool.confirmed_count>=v_pool.capacity then
    return jsonb_build_object('status','verified','tier',v_existing.tier,'survivalTime',v_run.validated_survival_time,'availability',game_availability());
  end if;
  v_threshold:=case when v_tier='GTD' then 60 else 45 end;

  if v_existing.id is not null then
    select * into v_old_res from reward_reservations where id=v_existing.reservation_id for update;
    update reward_reservations set status='released',updated_at=clock_timestamp() where id=v_existing.reservation_id;
    update reward_pools set confirmed_count=greatest(0,confirmed_count-1),updated_at=clock_timestamp() where tier=v_existing.tier;
  end if;

  insert into reward_reservations(run_id,user_id,tier,threshold_crossed_at,status,expires_at)
  values(p_run_id,p_user_id,v_tier,v_run.started_at+make_interval(secs=>v_threshold),'confirmed',null)
  on conflict(run_id,tier) do update set status='confirmed',expires_at=null,updated_at=clock_timestamp()
  returning * into v_new_res;
  update reward_pools set confirmed_count=confirmed_count+1,updated_at=clock_timestamp() where tier=v_tier;

  if v_existing.id is null then
    insert into whitelist_eligibility(user_id,run_id,reservation_id,tier,threshold_crossed_at,verified_at)
    values(p_user_id,p_run_id,v_new_res.id,v_tier,v_new_res.threshold_crossed_at,clock_timestamp());
  else
    update whitelist_eligibility set run_id=p_run_id,reservation_id=v_new_res.id,tier=v_tier,
      threshold_crossed_at=v_new_res.threshold_crossed_at,verified_at=clock_timestamp(),status='verified',
      wallet_address=null,share_url=null,share_post_id=null,share_status='not_started',shared_at=null,claimed_at=null
    where id=v_existing.id;
  end if;
  return jsonb_build_object('status','verified','tier',v_tier,'survivalTime',v_run.validated_survival_time,'availability',game_availability());
end $$;

revoke execute on function public.award_verified_game_reward(uuid,uuid) from public,anon,authenticated;
grant execute on function public.award_verified_game_reward(uuid,uuid) to service_role;

-- Repair verified threshold runs that completed before this function existed.
do $$
declare v_completed record;
begin
  for v_completed in
    select distinct on (user_id) id,user_id
    from public.game_runs
    where status='completed' and validated_survival_time>=45
    order by user_id,validated_survival_time desc,finished_at asc
  loop
    perform public.award_verified_game_reward(v_completed.id,v_completed.user_id);
  end loop;
end $$;
