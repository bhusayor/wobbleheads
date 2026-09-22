import { gameContext, gameError, gameJson, validRequestOrigin, withinRateLimit } from '@/lib/game/server';

export const runtime = 'nodejs';
const validWallet = (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value) || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
export async function POST(request: Request) {
  if (!validRequestOrigin(request)) return gameError('Invalid request origin.', 403);
  const context = await gameContext(); if (!context) return gameError('Authentication required.', 401);
  if (!await withinRateLimit(context.admin, context.user.id, 'claim', 60, 6)) return gameError('Too many claim requests.', 429);
  let body: Record<string, unknown>; try { body = await request.json() as Record<string, unknown>; } catch { return gameError('Invalid request.'); }
  const wallet = typeof body.wallet === 'string' ? body.wallet.trim() : '';
  if (!validWallet(wallet)) return gameError('Enter a valid EVM or Solana wallet.');
  const { data, error } = await context.admin.from('whitelist_eligibility').update({ wallet_address: wallet, claimed_at: new Date().toISOString(), status: 'claimed' }).eq('user_id', context.user.id).eq('status', 'verified').select('tier,wallet_address').maybeSingle();
  if (error?.code === '23505') return gameError('That wallet is already registered.', 409);
  if (error || !data) return gameError('No verified unclaimed game reward was found.', 409);
  return gameJson({ status: 'claimed', tier: data.tier, wallet: data.wallet_address });
}
