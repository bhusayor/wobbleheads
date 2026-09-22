import { gameContext, gameError, gameJson, parseRunRequest, validateRun, validRequestOrigin, withinRateLimit } from '@/lib/game/server';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  if (!validRequestOrigin(request)) return gameError('Invalid request origin.', 403);
  const context = await gameContext(); if (!context) return gameError('Authentication required.', 401);
  if (!await withinRateLimit(context.admin, context.user.id, 'finish', 60, 8)) return gameError('Too many finish requests.', 429);
  let body: Record<string, unknown>; try { body = await request.json() as Record<string, unknown>; } catch { return gameError('Invalid request.'); }
  const run = parseRunRequest(body); if (!run) return gameError('Invalid run.');
  const { data: match } = await context.admin.from('game_runs').select('id,final_result').eq('id', run.runId).eq('user_id', context.user.id).eq('run_token_hash', run.hash).maybeSingle();
  if (!match) return gameError('Invalid run.', 403); if (match.final_result) return gameJson(match.final_result);
  const validation = await validateRun(context.admin, run.runId, context.user.id);
  const { data, error } = await context.admin.rpc('finalize_game_run', { p_run_id: run.runId, p_user_id: context.user.id, p_valid: validation.valid, p_survival: validation.survival, p_flags: validation.flags });
  if (error) return gameError('Run verification failed.', 500);
  return gameJson(data);
}
