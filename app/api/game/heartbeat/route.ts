import { gameContext, gameError, gameJson, parseRunRequest, validRequestOrigin, withinRateLimit } from '@/lib/game/server';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  if (!validRequestOrigin(request)) return gameError('Invalid request origin.', 403);
  const context = await gameContext(); if (!context) return gameError('Authentication required.', 401);
  if (!await withinRateLimit(context.admin, context.user.id, 'heartbeat', 60, 50)) return gameError('Too many heartbeat requests.', 429);
  let body: Record<string, unknown>; try { body = await request.json() as Record<string, unknown>; } catch { return gameError('Invalid request.'); }
  const run = parseRunRequest(body); if (!run) return gameError('Invalid run.');
  const sequence = Number(body.sequence); const clientElapsed = Number(body.clientElapsed); const events = Array.isArray(body.pendingInputs) ? body.pendingInputs.slice(0, 20) : [];
  if (!Number.isInteger(sequence) || sequence < 1 || !Number.isFinite(clientElapsed) || clientElapsed < 0) return gameError('Invalid heartbeat.');
  const { data, error } = await context.admin.rpc('record_game_heartbeat', { p_run_id: run.runId, p_user_id: context.user.id, p_token_hash: run.hash, p_sequence: sequence, p_client_elapsed: clientElapsed, p_events: events });
  if (error) return gameError(error.message.includes('replay') ? 'Heartbeat already received.' : 'Heartbeat rejected.', 409);
  return gameJson(data);
}
