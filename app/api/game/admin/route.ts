import { gameContext, gameError, gameJson } from '@/lib/game/server';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  const context = await gameContext();
  if (!context) return gameError('Authentication required.', 401);
  const admins = (process.env.ADMIN_USER_IDS || '').split(',').map((id) => id.trim()).filter(Boolean);
  if (!admins.includes(context.user.id)) return gameError('Admin access required.', 403);
  const url = new URL(request.url);
  const exportTier = url.searchParams.get('export')?.toUpperCase();
  if (exportTier === 'GTD' || exportTier === 'FCFS') {
    const { data, error } = await context.admin.from('whitelist_eligibility')
      .select('user_id,wallet_address,x_handle,share_url,verified_at,claimed_at,game_runs(validated_survival_time)')
      .eq('tier', exportTier).eq('status', 'claimed').not('wallet_address', 'is', null)
      .order('claimed_at', { ascending: true });
    if (error) return gameError('Could not export claimed wallets.', 500);
    const safeCell = (value: string | number | null | undefined) => {
      let text = value === null || value === undefined ? '' : String(value);
      if (/^[=+\-@]/.test(text)) text = `'${text}`;
      return `"${text.replaceAll('"', '""')}"`;
    };
    const fields = ['wallet', 'x_username', 'x_post_url', 'verified_survival_seconds', 'claimed_at', 'user_id'];
    const rows = (data || []).map((entry) => {
      const run = Array.isArray(entry.game_runs) ? entry.game_runs[0] : entry.game_runs;
      return [entry.wallet_address, entry.x_handle ? `@${entry.x_handle}` : '', entry.share_url, Number(run?.validated_survival_time || 0).toFixed(3), entry.claimed_at, entry.user_id];
    });
    const csv = `\uFEFF${[fields, ...rows].map((row) => row.map(safeCell).join(',')).join('\r\n')}`;
    const date = new Date().toISOString().slice(0, 10);
    return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="wobbleheads-${exportTier.toLowerCase()}-claimed-${date}.csv"`, 'Cache-Control': 'private, no-store' } });
  }
  const status = url.searchParams.get('status');
  let query = context.admin.from('game_runs').select('id,user_id,game_version,mode,started_at,last_heartbeat_at,heartbeat_count,status,finished_at,validated_survival_time,suspicious_score,suspicious_flags,final_result,reward_reservations(id,tier,threshold_crossed_at,status,reservation_order,expires_at)').order('created_at', { ascending: false }).limit(100);
  if (status && ['active', 'completed', 'invalid', 'review', 'abandoned'].includes(status)) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) return gameError('Could not load game review data.', 500);
  return gameJson({ runs: data });
}
