import { randomUUID } from 'node:crypto';
import { GAME_VERSION } from '@/lib/game/config';
import { gameContext, gameError, gameJson, newRunToken, tokenHash, validRequestOrigin, withinRateLimit } from '@/lib/game/server';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  if (!validRequestOrigin(request)) return gameError('Invalid request origin.', 403);
  const context = await gameContext();
  if (!context) return gameError('Sign in with X before starting a competitive run.', 401);
  if (!await withinRateLimit(context.admin, context.user.id, 'start', 60, 8)) return gameError('Please wait before starting another run.', 429);
  let body: Record<string, unknown> = {};
  try { body = await request.json() as Record<string, unknown>; } catch { return gameError('Invalid request.'); }
  const width = Math.round(Number(body.width)); const height = Math.round(Number(body.height));
  if (width < 320 || width > 7680 || height < 240 || height > 4320) return gameError('Invalid viewport.');
  const mode = width > height && Math.min(width, height) <= 500 && Math.max(width, height) <= 960 ? 'mobile_landscape' : 'desktop';
  const runToken = newRunToken(); const seed = randomUUID();
  const { data, error } = await context.admin.rpc('start_game_run', { p_user_id: context.user.id, p_seed: seed, p_token_hash: tokenHash(runToken), p_game_version: GAME_VERSION, p_width: width, p_height: height, p_mode: mode });
  if (error || !data) return gameError('Could not start a secure run.', 500);
  const { data: availability } = await context.admin.rpc('game_availability');
  return gameJson({ runId: data.id, seed, startedAt: data.started_at, gameVersion: GAME_VERSION, runToken, availability });
}
