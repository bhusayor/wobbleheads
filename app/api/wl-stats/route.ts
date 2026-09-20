import { database, error, json } from '@/lib/server';
import { deriveWobbleWLStats } from '@/lib/site-config';

export const runtime = 'edge';

export async function GET() {
  try {
    const db = database();
    const [attempts, claims] = await Promise.all([
      db.prepare("SELECT COUNT(DISTINCT participant_id) AS count FROM xp_events WHERE event_key LIKE 'rarity:%'").first<{ count: number }>(),
      db.prepare("SELECT wl_category,COUNT(*) AS count FROM participants WHERE wl_category IN ('gtd','fcfs') AND wl_status IN ('pending','approved') GROUP BY wl_category").all<{ wl_category: string; count: number }>(),
    ]);
    const counts = Object.fromEntries((claims.results || []).map((row) => [row.wl_category, Number(row.count || 0)]));
    return json(deriveWobbleWLStats({
      playersAttempted: Number(attempts?.count || 0),
      gtdClaimed: counts.gtd || 0,
      fcfsClaimed: counts.fcfs || 0,
    }));
  } catch (cause) {
    return error(cause instanceof Error ? cause.message : 'Live WL numbers are temporarily unavailable.', 500);
  }
}