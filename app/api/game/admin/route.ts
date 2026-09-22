import { gameContext, gameError, gameJson } from '@/lib/game/server';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  const context = await gameContext();
  if (!context) return gameError('Authentication required.', 401);
  const admins = (process.env.ADMIN_USER_IDS || '').split(',').map((id) => id.trim()).filter(Boolean);
  if (!admins.includes(context.user.id)) return gameError('Admin access required.', 403);
  const url = new URL(request.url); const status = url.searchParams.get('status');
  let query = context.admin.from('game_runs').select('id,user_id,game_version,mode,started_at,last_heartbeat_at,heartbeat_count,status,finished_at,validated_survival_time,suspicious_score,suspicious_flags,final_result,reward_reservations(id,tier,threshold_crossed_at,status,reservation_order,expires_at)').order('created_at', { ascending: false }).limit(100);
  if (status && ['active', 'completed', 'invalid', 'review', 'abandoned'].includes(status)) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) return gameError('Could not load game review data.', 500);
  return gameJson({ runs: data });
}
