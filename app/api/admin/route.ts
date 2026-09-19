import { award, database, error, identity, isAdmin, json, readText, settings } from '@/lib/server';
import { MANUAL_TASKS, TASK_KEYS, XP } from '@/lib/site-config';

export const runtime = 'edge';

async function authorized() {
  const user = await identity();
  return user && isAdmin(user.userId) ? user : null;
}

export async function GET(request: Request) {
  if (!await authorized()) return error('Admin access required.', 403);
  const db = database();
  const url = new URL(request.url);
  const historyId = url.searchParams.get('history');
  if (historyId) {
    const events = (await db.prepare('SELECT event_key,event_date,xp,metadata,created_at FROM xp_events WHERE participant_id=? ORDER BY created_at DESC LIMIT 100').bind(historyId).all()).results;
    const submissions = (await db.prepare('SELECT task_key,status,note,created_at FROM submissions WHERE participant_id=? ORDER BY created_at DESC').bind(historyId).all()).results;
    return json({ events, submissions });
  }
  const exportType = url.searchParams.get('export');
  if (exportType === 'winners' || exportType === 'wallets') {
    const rows = (await db.prepare("SELECT id,display_name,wallet,wl_category,approved_at,xp FROM participants WHERE wl_status='approved' ORDER BY approved_at DESC").all()).results as Record<string, string | number | null>[];
    const fields = exportType === 'wallets' ? ['wallet'] : ['id', 'display_name', 'wallet', 'wl_category', 'approved_at', 'xp'];
    const quote = (value: unknown) => `"${(typeof value === 'string' || typeof value === 'number' ? String(value) : '').replaceAll('"', '""')}"`;
    const csv = [fields.join(','), ...rows.map((row) => fields.map((field) => quote(row[field])).join(','))].join('\r\n');
    return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="wobbleheads-${exportType}.csv"`, 'Cache-Control': 'no-store' } });
  }
  const query = (url.searchParams.get('q') || '').trim().slice(0, 80);
  const pattern = `%${query}%`;
  const participants = (await db.prepare('SELECT * FROM participants WHERE ?="" OR id LIKE ? OR display_name LIKE ? OR email LIKE ? OR wallet LIKE ? OR x_username LIKE ? ORDER BY created_at DESC LIMIT 100')
    .bind(query, pattern, pattern, pattern, pattern, pattern).all()).results;
  const submissions = (await db.prepare('SELECT s.*,p.display_name FROM submissions s JOIN participants p ON p.id=s.participant_id ORDER BY s.created_at DESC LIMIT 100').all()).results;
  const referrals = (await db.prepare('SELECT * FROM referrals ORDER BY created_at DESC LIMIT 100').all()).results;
  const settingRows = (await db.prepare('SELECT key,value FROM settings').all()).results;
  return json({ participants, submissions, referrals, settings: settingRows });
}

export async function POST(request: Request) {
  const user = await authorized();
  if (!user) return error('Admin access required.', 403);
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return error('Invalid request.'); }
  const db = database();
  const action = readText(body.action);
  try {
    if (action === 'review') {
      const id = readText(body.id);
      const status = readText(body.status);
      if (!['approved', 'rejected'].includes(status)) return error('Invalid review status.');
      const submission = await db.prepare('SELECT * FROM submissions WHERE id=?').bind(id).first<{ participant_id: string; task_key: string; status: string }>();
      if (!submission || submission.status !== 'pending') return error('This submission is no longer pending.');
      const result = await db.prepare("UPDATE submissions SET status=?,note=?,reviewed_by=? WHERE id=? AND status='pending'")
        .bind(status, readText(body.note).slice(0, 300) || null, user.userId, id).run();
      if (!result.meta.changes) return error('This submission is no longer pending.');
      if (status === 'approved' && MANUAL_TASKS.some((key) => key === submission.task_key)) {
        const config = await settings();
        await award(submission.participant_id, `task:${submission.task_key}`, config.rewards[submission.task_key as keyof typeof config.rewards] || 0);
      }
      return json({ ok: true });
    }
    if (action === 'wl') {
      const id = readText(body.id);
      const status = readText(body.status);
      const category = readText(body.category);
      if (!['approved', 'rejected'].includes(status)) return error('Invalid WL status.');
      if (status === 'approved' && !['Guaranteed WL', 'Raffle WL', 'Community WL'].includes(category)) return error('Choose a WL category.');
      const result = await db.prepare("UPDATE participants SET wl_status=?,wl_category=?,approved_at=? WHERE id=? AND wallet IS NOT NULL AND wl_status IN ('pending','eligible','approved','rejected')")
        .bind(status, status === 'approved' ? category : null, status === 'approved' ? new Date().toISOString() : null, id).run();
      if (!result.meta.changes) return error('Participant not found or has no wallet.');
      return json({ ok: true });
    }
    if (action === 'xp') {
      const id = readText(body.id);
      const amount = Number(body.amount);
      if (!Number.isInteger(amount) || amount < -300 || amount > 300 || amount === 0) return error('Adjustment must be a whole number between -300 and 300.');
      const participant = await db.prepare('SELECT id,xp FROM participants WHERE id=?').bind(id).first<{ id: string; xp: number }>();
      if (!participant) return error('Participant not found.');
      const applied = Math.max(0, Number(participant.xp) + amount) - Number(participant.xp);
      await award(id, `admin:${crypto.randomUUID()}`, applied, '', `Adjusted by ${user.userId}`);
      return json({ ok: true, applied });
    }
    if (action === 'suspicious') {
      await db.prepare('UPDATE participants SET suspicious=? WHERE id=?').bind(body.flag ? 1 : 0, readText(body.id)).run();
      return json({ ok: true });
    }
    if (action === 'referral') {
      const referredId = readText(body.id);
      const status = readText(body.status);
      if (!['approved', 'rejected'].includes(status)) return error('Invalid referral status.');
      const referral = await db.prepare("SELECT referrer_id,status FROM referrals WHERE referred_id=?").bind(referredId).first<{ referrer_id: string; status: string }>();
      if (!referral || referral.status !== 'pending') return error('Referral already reviewed.');
      await db.prepare("UPDATE referrals SET status=? WHERE referred_id=? AND status='pending'").bind(status, referredId).run();
      if (status === 'approved') await award(referral.referrer_id, `referral:${referredId}`, (await settings()).rewards.referral);
      return json({ ok: true });
    }
    if (action === 'setting') {
      const key = readText(body.key);
      const rewardKey = key.startsWith('reward.') ? key.slice(7) : '';
      const taskKey = key.startsWith('task.') ? key.slice(5) : '';
      if (!['xUrl', 'discordUrl', 'blockchain', 'wlThreshold', 'mintDate', 'mintPrice', 'contractAddress', 'resultsPublished', 'leaderboardLocked'].includes(key) && !(rewardKey in XP) && !TASK_KEYS.some((task) => task === taskKey)) return error('Unknown setting.');
      const value = readText(body.value).trim().slice(0, 300);
      if ((key === 'xUrl' || key === 'discordUrl') && value && !/^https:\/\//i.test(value)) return error('Use an HTTPS link.');
      if (key === 'wlThreshold' && (!/^\d{1,4}$/.test(value) || Number(value) > 1000)) return error('Invalid XP threshold.');
      if (rewardKey && (!/^\d{1,3}$/.test(value) || Number(value) > 100)) return error('XP reward must be between 0 and 100.');
      if (taskKey && !['true', 'false'].includes(value)) return error('Task availability must be true or false.');
      if (key === 'blockchain' && !['evm', 'solana'].includes(value)) return error('Choose evm or solana.');
      if (key === 'mintDate' && value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return error('Use YYYY-MM-DD for the mint date.');
      if (key === 'resultsPublished' || key === 'leaderboardLocked') {
        if (!['true', 'false'].includes(value)) return error('Use true or false.');
      }
      await db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(key, value).run();
      if (key === 'leaderboardLocked' && value === 'true') {
        const rows = (await db.prepare('SELECT display_name,xp,badge,wl_status FROM participants WHERE public_leaderboard=1 AND suspicious=0 ORDER BY xp DESC LIMIT 10').all()).results;
        await db.prepare("INSERT INTO settings (key,value) VALUES ('leaderboardSnapshot',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(JSON.stringify(rows)).run();
      }
      return json({ ok: true });
    }
    return error('Unknown action.');
  } catch (cause) { return error(cause instanceof Error ? cause.message : 'Admin action failed.', 500); }
}
