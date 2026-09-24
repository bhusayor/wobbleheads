import { error, json } from '@/lib/server';
import {
  COLLAB_FCFS_RESERVED,
  COLLAB_GTD_RESERVED,
  deriveWobbleWLStats,
  PUBLIC_ATTEMPT_OFFSET,
  PUBLIC_UNIQUE_PLAYER_OFFSET,
} from '@/lib/site-config';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const admin = createAdminClient();
    let { data: stats, error: statsError } = await admin.rpc('game_public_stats');
    if (statsError) {
      const [{ count }, { data: availability, error: availabilityError }] = await Promise.all([
        admin.from('game_runs').select('id', { count: 'exact', head: true }),
        admin.rpc('game_availability'),
      ]);
      if (availabilityError) throw availabilityError;
      const unique = new Set<string>();
      for (let from = 0; ; from += 1000) {
        const { data: page, error } = await admin.from('game_runs').select('user_id').range(from, from + 999);
        if (error) throw error;
        page.forEach((run) => unique.add(run.user_id));
        if (page.length < 1000) break;
      }
      stats = { uniquePlayers: unique.size, challengeAttempts: count || 0, availability };
      statsError = null;
    }
    const [{ count: gtdClaimed, error: gtdError }, { count: fcfsClaimed, error: fcfsError }] = await Promise.all([
      admin.from('whitelist_eligibility').select('id', { count: 'exact', head: true }).eq('tier', 'GTD').eq('status', 'claimed').not('wallet_address', 'is', null),
      admin.from('whitelist_eligibility').select('id', { count: 'exact', head: true }).eq('tier', 'FCFS').eq('status', 'claimed').not('wallet_address', 'is', null),
    ]);
    if (gtdError || fcfsError) throw gtdError || fcfsError;
    return json(deriveWobbleWLStats({
      uniquePlayers: Number(stats.uniquePlayers || 0) + PUBLIC_UNIQUE_PLAYER_OFFSET,
      challengeAttempts: Number(stats.challengeAttempts || 0) + PUBLIC_ATTEMPT_OFFSET,
      gtdClaimed: (gtdClaimed || 0) + COLLAB_GTD_RESERVED,
      fcfsClaimed: (fcfsClaimed || 0) + COLLAB_FCFS_RESERVED,
    }));
  } catch (cause) {
    return error(cause instanceof Error ? cause.message : 'Live WL numbers are temporarily unavailable.', 500);
  }
}
