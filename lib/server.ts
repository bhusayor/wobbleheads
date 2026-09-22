import { env } from '@/lib/runtime-env';
import { createClient } from '@/lib/supabase/server';
import { TASK_KEYS, XP } from './site-config';

export type Participant = {
  id: string; email: string; display_name: string; x_username: string | null;
  wallet: string | null; public_leaderboard: number; xp: number; badge: string | null;
  wl_status: string; wl_category: string | null; approved_at: string | null;
  suspicious: number; created_at: string;
};

export function database() {
  if (!env.DB) throw new Error('Database binding unavailable');
  return env.DB;
}

export async function identity() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const metadata = user.user_metadata || {};
  const handle = metadata.user_name || metadata.preferred_username;
  return {
    userId: user.id,
    email: user.email || `${user.id}@x-user.invalid`,
    fullName: metadata.full_name || metadata.name || (handle ? `@${handle}` : 'Wobblehead'),
  };
}

export async function currentParticipant(create = false): Promise<Participant | null> {
  const user = await identity();
  if (!user) return null;
  const db = database();
  if (create) {
    await db.prepare('INSERT OR IGNORE INTO participants (id,email,display_name,created_at) VALUES (?,?,?,?)')
      .bind(user.userId, user.email, user.fullName || user.email.split('@')[0], new Date().toISOString()).run();
  }
  return (await db.prepare('SELECT * FROM participants WHERE id=?').bind(user.userId).first()) as Participant | null;
}

export function isAdmin(userId: string | undefined | null) {
  const ids = String((env as Cloudflare.Env & { ADMIN_USER_IDS?: string }).ADMIN_USER_IDS || '').split(',').map((id) => id.trim()).filter(Boolean);
  return !!userId && ids.includes(userId);
}

export async function award(participantId: string, key: string, xp: number, date = '', metadata = '') {
  const db = database();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const results = await db.batch([
    db.prepare('INSERT OR IGNORE INTO xp_events (id,participant_id,event_key,event_date,xp,metadata,created_at) VALUES (?,?,?,?,?,?,?)')
      .bind(id, participantId, key, date, xp, metadata, now),
    db.prepare('UPDATE participants SET xp=xp+? WHERE id=? AND EXISTS (SELECT 1 FROM xp_events WHERE id=?)')
      .bind(xp, participantId, id),
  ]);
  return Number(results[0].meta.changes || 0) > 0;
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function error(message: string, status = 400) { return json({ error: message }, status); }
export function readText(value: unknown) { return typeof value === 'string' ? value : ''; }

export async function settings() {
  const rows = await database().prepare('SELECT key,value FROM settings').all<{ key: string; value: string }>();
  const map = Object.fromEntries((rows.results || []).map(({ key, value }) => [key, value]));
  const vars = env as Cloudflare.Env;
  const rewards = { ...XP } as Record<keyof typeof XP, number>;
  for (const key of Object.keys(XP) as (keyof typeof XP)[]) {
    const override = Number(map[`reward.${key}`]);
    if (map[`reward.${key}`] !== undefined && Number.isInteger(override) && override >= 0 && override <= 100) rewards[key] = override;
  }
  const available = Object.fromEntries(TASK_KEYS.map((key) => [key, map[`task.${key}`] !== 'false'])) as Record<(typeof TASK_KEYS)[number], boolean>;
  const threshold = Number(map.wlThreshold || vars.WL_THRESHOLD || 150);
  return {
    xUrl: map.xUrl || vars.X_URL || '', discordUrl: map.discordUrl || vars.DISCORD_URL || '',
    blockchain: map.blockchain || vars.BLOCKCHAIN || 'evm',
    mintDate: map.mintDate || vars.MINT_DATE || '', mintPrice: map.mintPrice || vars.MINT_PRICE || '', contractAddress: map.contractAddress || vars.CONTRACT_ADDRESS || '',
    wlThreshold: Number.isFinite(threshold) ? Math.max(0, threshold) : 150,
    rewards, available,
  };
}
