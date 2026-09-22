import { error, json } from '@/lib/server';
import { deriveWobbleWLStats } from '@/lib/site-config';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const admin = createAdminClient();
    const [{ count: attempts }, { data: availability, error: availabilityError }] = await Promise.all([
      admin.from('game_runs').select('user_id', { count: 'exact', head: true }),
      admin.rpc('game_availability'),
    ]);
    if (availabilityError) throw availabilityError;
    return json(deriveWobbleWLStats({
      playersAttempted: Number(attempts || 0),
      gtdClaimed: Number(availability.GTD.capacity - availability.GTD.remaining),
      fcfsClaimed: Number(availability.FCFS.capacity - availability.FCFS.remaining),
    }));
  } catch (cause) {
    return error(cause instanceof Error ? cause.message : 'Live WL numbers are temporarily unavailable.', 500);
  }
}
