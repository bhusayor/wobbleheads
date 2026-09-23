import { gameContext, gameError, gameJson, validRequestOrigin } from '@/lib/game/server';

export const runtime = 'nodejs';

async function adminContext() {
  const context = await gameContext();
  if (!context) return null;
  const admins = (process.env.ADMIN_USER_IDS || '').split(',').map((id) => id.trim()).filter(Boolean);
  return admins.includes(context.user.id) ? context : null;
}

export async function GET(request: Request) {
  const context = await adminContext();
  if (!context) return gameError('Admin access required.', 403);
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
  const claimFields = 'user_id,wallet_address,x_handle,share_url,claimed_at';
  const [gtdResult, fcfsResult] = await Promise.all([
    context.admin.from('whitelist_eligibility').select(claimFields).eq('tier', 'GTD').eq('status', 'claimed').not('wallet_address', 'is', null).order('claimed_at', { ascending: true }),
    context.admin.from('whitelist_eligibility').select(claimFields).eq('tier', 'FCFS').eq('status', 'claimed').not('wallet_address', 'is', null).order('claimed_at', { ascending: true }),
  ]);
  if (gtdResult.error || fcfsResult.error) return gameError('Could not load claimed wallets.', 500);
  return gameJson({ gtd: gtdResult.data || [], fcfs: fcfsResult.data || [], generatedAt: new Date().toISOString() });
}

export async function POST(request: Request) {
  if (!validRequestOrigin(request)) return gameError('Invalid request origin.', 403);
  const context = await adminContext();
  if (!context) return gameError('Admin access required.', 403);
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return gameError('Invalid request.'); }
  if (body.action !== 'reset-live-data' || body.confirmation !== 'RESET') return gameError('Type RESET to confirm the live data reset.', 400);

  const emptyUuid = '00000000-0000-0000-0000-000000000000';
  const eligibility = await context.admin.from('whitelist_eligibility').delete().neq('id', emptyUuid);
  if (eligibility.error) return gameError('Could not clear whitelist claims.', 500);
  const runs = await context.admin.from('game_runs').delete().neq('id', emptyUuid);
  if (runs.error) return gameError('Could not clear game runs.', 500);
  const limits = await context.admin.from('game_rate_limits').delete().neq('user_id', emptyUuid);
  if (limits.error) return gameError('Could not clear game rate limits.', 500);
  const pools = await context.admin.from('reward_pools').update({ confirmed_count: 0, updated_at: new Date().toISOString() }).in('tier', ['GTD', 'FCFS']);
  if (pools.error) return gameError('Game data was cleared, but allocation counters could not be reset.', 500);

  return gameJson({ status: 'reset', gtd: [], fcfs: [], generatedAt: new Date().toISOString() });
}
