import { createAdminClient } from '@/lib/supabase/admin';
import { gameError, gameJson } from '@/lib/game/server';

export const runtime = 'nodejs';
export async function GET() {
  try {
    const admin = createAdminClient();
    await admin.rpc('expire_game_reservations');
    const { data, error } = await admin.rpc('game_availability');
    if (error) throw error;
    return gameJson(data);
  } catch { return gameError('Availability is temporarily unavailable.', 503); }
}
