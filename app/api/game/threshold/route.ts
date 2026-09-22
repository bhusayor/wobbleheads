import { gameContext, gameError, gameJson, parseRunRequest, validRequestOrigin, withinRateLimit } from '@/lib/game/server';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  if (!validRequestOrigin(request)) return gameError('Invalid request origin.', 403);
  const context = await gameContext(); if (!context) return gameError('Authentication required.', 401);
  if (!await withinRateLimit(context.admin, context.user.id, 'threshold', 60, 8)) return gameError('Too many threshold requests.', 429);
  let body: Record<string, unknown>; try { body = await request.json() as Record<string, unknown>; } catch { return gameError('Invalid request.'); }
  const run = parseRunRequest(body); if (!run) return gameError('Invalid run.');
  const tier = body.threshold === 'GTD' ? 'GTD' : body.threshold === 'FCFS' ? 'FCFS' : '';
  if (!tier) return gameError('Invalid threshold.');
  const { data: match } = await context.admin.from('game_runs').select('id').eq('id', run.runId).eq('user_id', context.user.id).eq('run_token_hash', run.hash).maybeSingle();
  if (!match) return gameError('Invalid run.', 403);
  const { data, error } = await context.admin.rpc('reserve_game_reward', { p_run_id: run.runId, p_user_id: context.user.id, p_tier: tier });
  if (error) return gameError(error.message.includes('threshold_too_early') ? 'Threshold has not been reached.' : 'Qualification could not be recorded.', 409);
  return gameJson(data);
}
