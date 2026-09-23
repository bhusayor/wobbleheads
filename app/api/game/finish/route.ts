import { gameContext, gameError, gameJson, parseRunRequest, validateRun, validRequestOrigin, withinRateLimit } from '@/lib/game/server';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  if (!validRequestOrigin(request)) return gameError('Invalid request origin.', 403);
  const context = await gameContext(); if (!context) return gameError('Authentication required.', 401);
  if (!await withinRateLimit(context.admin, context.user.id, 'finish', 60, 8)) return gameError('Too many finish requests.', 429);
  let body: Record<string, unknown>; try { body = await request.json() as Record<string, unknown>; } catch { return gameError('Invalid request.'); }
  const run = parseRunRequest(body); if (!run) return gameError('Invalid run.');
  const { data: match } = await context.admin.from('game_runs').select('id,final_result').eq('id', run.runId).eq('user_id', context.user.id).eq('run_token_hash', run.hash).maybeSingle();
  if (!match) return gameError('Invalid run.', 403);
  if (match.final_result) {
    const previous = match.final_result as Record<string, unknown>;
    if (previous.status === 'verified') {
      const { data: awarded } = await context.admin.rpc('award_verified_game_reward', { p_run_id: run.runId, p_user_id: context.user.id });
      if (awarded) return gameJson({ ...previous, ...awarded });
      const { data: existing } = await context.admin.from('whitelist_eligibility').select('tier').eq('user_id', context.user.id).in('status', ['verified', 'claimed']).maybeSingle();
      if (existing?.tier) return gameJson({ ...previous, tier: existing.tier, status: 'verified' });
    }
    return gameJson(previous);
  }
  const validation = await validateRun(context.admin, run.runId, context.user.id);
  const { data, error } = await context.admin.rpc('finalize_game_run', { p_run_id: run.runId, p_user_id: context.user.id, p_valid: validation.valid, p_survival: validation.survival, p_flags: validation.flags });
  if (error) return gameError('Run verification failed.', 500);
  if (!validation.valid) return gameJson(data);

  // The verified server time is authoritative. This also recovers when the
  // browser's threshold request was delayed or lost, and upgrades FCFS to GTD.
  const { data: awarded, error: awardError } = await context.admin.rpc('award_verified_game_reward', { p_run_id: run.runId, p_user_id: context.user.id });
  if (!awardError && awarded) return gameJson({ ...data, ...awarded });

  // Deployments that have not installed the award RPC yet should still show
  // a reward the player already owns instead of incorrectly showing no WL.
  const { data: existing } = await context.admin.from('whitelist_eligibility').select('tier').eq('user_id', context.user.id).in('status', ['verified', 'claimed']).maybeSingle();
  return gameJson(existing?.tier ? { ...data, tier: existing.tier, status: 'verified' } : data);
}
