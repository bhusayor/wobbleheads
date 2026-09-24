import { gameContext, gameError, gameJson, validRequestOrigin, withinRateLimit } from '@/lib/game/server';

export const runtime = 'nodejs';

const postPattern = /^https:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/([A-Za-z0-9_]{1,15})\/status\/(\d+)(?:[/?#].*)?$/i;

export async function POST(request: Request) {
  if (!validRequestOrigin(request)) return gameError('Invalid request origin.', 403);
  const context = await gameContext();
  if (!context) return gameError('Authentication required.', 401);
  if (!await withinRateLimit(context.admin, context.user.id, 'share', 60, 10)) return gameError('Too many share requests.', 429);
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return gameError('Invalid request.'); }

  const { data: eligibility, error: eligibilityError } = await context.admin.from('whitelist_eligibility')
    .select('id,run_id,tier,status,share_status,share_url,game_runs(validated_survival_time)')
    .eq('user_id', context.user.id).in('status', ['verified', 'claimed']).maybeSingle();
  if (eligibilityError || !eligibility) return gameError('No verified game reward was found.', 409);

  const metadata = context.user.user_metadata || {};
  const handle = String(metadata.user_name || metadata.preferred_username || '').replace(/^@/, '');
  const avatar = String(metadata.avatar_url || metadata.picture || metadata.profile_image_url || '');
  if (!handle) return gameError('Your X username is unavailable. Sign out and reconnect X.', 409);
  const gameRun = Array.isArray(eligibility.game_runs) ? eligibility.game_runs[0] : eligibility.game_runs;
  const seconds = Number(gameRun?.validated_survival_time || 0);
  const { data: upgradeState } = eligibility.tier === 'GTD'
    ? await context.admin.from('whitelist_eligibility').select('upgraded_from_claimed_fcfs').eq('id', eligibility.id).eq('user_id', context.user.id).maybeSingle()
    : { data: null };
  const isGtdUpgrade = eligibility.tier === 'GTD' && upgradeState?.upgraded_from_claimed_fcfs === true;

  if (body.action === 'prepare') {
    const { error } = await context.admin.from('whitelist_eligibility').update({ x_handle: handle, x_avatar_url: avatar || null }).eq('id', eligibility.id).eq('user_id', context.user.id);
    if (error) return gameError('Could not prepare your share.', 500);
    const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
    const origin = new URL(request.url).hostname === 'localhost' ? new URL(request.url).origin : configuredOrigin || new URL(request.url).origin;
    const shareUrl = `${origin}/wobble-win/${eligibility.id}?run=${eligibility.run_id}`;
    const text = isGtdUpgrade
      ? `WL SPOT UPGRADED: FCFS → GTD 🫨\n\nI kept wobbling for ${seconds.toFixed(1)} seconds and earned my GTD upgrade with @Wobbleheadds.\n\nThe wobble paid off. Think you can reach GTD?\n\n#KeepItWobbling`
      : `I KEPT IT WOBBLING 🫨\n\nI survived ${seconds.toFixed(1)} seconds and secured my ${eligibility.tier} spot with @Wobbleheadds.\n\nThink you can beat my time?\n\n#KeepItWobbling`;
    const intentUrl = `https://x.com/intent/post?${new URLSearchParams({ text, url: shareUrl })}`;
    return gameJson({ intentUrl, shareUrl, handle, avatar: avatar || null, seconds, tier: eligibility.tier, isGtdUpgrade, submitted: eligibility.share_status === 'submitted' });
  }

  if (body.action === 'submit') {
    const postUrl = typeof body.postUrl === 'string' ? body.postUrl.trim() : '';
    const match = postUrl.match(postPattern);
    if (!match) return gameError('Paste a complete X post URL, such as https://x.com/yourname/status/123.');
    if (match[1].toLowerCase() !== handle.toLowerCase()) return gameError(`The post URL must belong to @${handle}.`, 409);
    const canonical = `https://x.com/${handle}/status/${match[2]}`;
    const { data, error } = await context.admin.from('whitelist_eligibility').update({ x_handle: handle, x_avatar_url: avatar || null, share_url: canonical, share_post_id: match[2], share_status: 'submitted', shared_at: new Date().toISOString() }).eq('id', eligibility.id).eq('user_id', context.user.id).select('tier,share_url').single();
    if (error?.code === '23505') return gameError('That X post has already been used.', 409);
    if (error || !data) return gameError('Could not save the X post.', 500);
    return gameJson({ status: 'submitted', tier: data.tier, postUrl: data.share_url });
  }

  return gameError('Unknown share action.');
}
