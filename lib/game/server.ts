import { createHash, randomBytes } from 'node:crypto';
import { createClient as createSessionClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { GAME_VERSION, HEARTBEAT_GRACE_SECONDS, MAX_JUMPS_PER_SECOND } from './config';
import { replaySurvival } from './replay';

export async function gameContext() {
  const session = await createSessionClient();
  const { data: { user } } = await session.auth.getUser();
  return user ? { user, admin: createAdminClient() } : null;
}

export function validRequestOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try { return new URL(origin).host === new URL(request.url).host; } catch { return false; }
}

export async function withinRateLimit(admin: ReturnType<typeof createAdminClient>, userId: string, action: string, windowSeconds: number, limit: number) {
  const { data, error } = await admin.rpc('check_game_rate_limit', { p_user_id: userId, p_action: action, p_window_seconds: windowSeconds, p_limit: limit });
  return !error && data === true;
}

export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export const newRunToken = () => randomBytes(32).toString('base64url');

export function gameError(message: string, status = 400) {
  return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function gameJson(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function parseRunRequest(body: Record<string, unknown>) {
  const runId = typeof body.runId === 'string' ? body.runId : '';
  const runToken = typeof body.runToken === 'string' ? body.runToken : '';
  if (!/^[0-9a-f-]{36}$/i.test(runId) || runToken.length < 32) return null;
  return { runId, runToken, hash: tokenHash(runToken) };
}

export async function validateRun(admin: ReturnType<typeof createAdminClient>, runId: string, userId: string) {
  const [{ data: run, error }, { data: events }] = await Promise.all([
    admin.from('game_runs').select('*').eq('id', runId).eq('user_id', userId).single(),
    admin.from('game_events').select('sequence,game_time,event_type').eq('run_id', runId).order('sequence'),
  ]);
  if (error || !run) return { valid: false, survival: 0, flags: ['run_not_found'] };
  const serverElapsed = Math.max(0, (Date.now() - Date.parse(run.started_at)) / 1000);
  const survival = Math.min(serverElapsed, Number(run.client_elapsed || 0));
  const flags: string[] = [];
  if (run.game_version !== GAME_VERSION) flags.push('game_version_mismatch');
  if ((Date.now() - Date.parse(run.last_heartbeat_at)) / 1000 > HEARTBEAT_GRACE_SECONDS) flags.push('stale_heartbeat');
  if (Math.abs(serverElapsed - Number(run.client_elapsed || 0)) > 4) flags.push('clock_drift');
  const list = events || [];
  for (let index = 1; index < list.length; index++) {
    if (list[index].sequence <= list[index - 1].sequence || list[index].game_time < list[index - 1].game_time) flags.push('event_order');
    if (list[index].game_time - list[index - 1].game_time < 1 / MAX_JUMPS_PER_SECOND) flags.push('input_spam');
  }
  const replayed = replaySurvival(run, list, survival, 60);
  if (replayed + .75 < survival) flags.push('replay_collision');
  return { valid: flags.length === 0 && Number(run.heartbeat_count) >= Math.floor(survival / 3), survival: Math.min(survival, replayed), flags };
}
