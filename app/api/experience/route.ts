import { CHALLENGES, MANUAL_TASKS, validWallet, safeDisplay } from '@/lib/site-config';
import { award, currentParticipant, database, error, json, readText, settings } from '@/lib/server';
import traitOptions from '@/app/trait-options.json';

export const runtime = 'edge';
const today = () => new Date().toISOString().slice(0, 10);
const traitLayers = Object.keys(traitOptions) as (keyof typeof traitOptions)[];
const validTraits = (value: unknown): value is number[] => Array.isArray(value) && value.length === 7 && value.every((index, position) => Number.isInteger(index) && index >= 0 && index < traitOptions[traitLayers[position]].length);
const personalities = ['The Sleepy Wobble', 'The Chaotic Wobble', 'The Suspicious Wobble', 'The Quiet Wobble', 'The Legendary Wobble'];
const challengeFor = (attempt: number) => CHALLENGES[(Number(today().replaceAll('-', '')) + attempt * 7) % CHALLENGES.length];
const challengePublic = (attempt: number) => {
  const choice = challengeFor(attempt);
  return { id: choice.id, image: `/images/challenges/challenge-${String(choice.id).padStart(4, '0')}.svg`, remaining: Math.max(0, 3 - attempt) };
};

export async function GET() {
  try {
    const db = database();
    const participant = await currentParticipant(true);
    const config = await settings();
    const date = today();
    const attemptRow = participant ? await db.prepare("SELECT COUNT(*) AS count FROM xp_events WHERE participant_id=? AND event_key LIKE 'rarity:%' AND event_date=?").bind(participant.id, date).first<{ count: number }>() : null;
    const attempts = Number(attemptRow?.count || 0);
    const events = participant ? (await db.prepare('SELECT event_key,event_date,xp,created_at FROM xp_events WHERE participant_id=? ORDER BY created_at DESC LIMIT 100').bind(participant.id).all()).results : [];
    const submissions = participant ? (await db.prepare('SELECT task_key,status,note,created_at FROM submissions WHERE participant_id=?').bind(participant.id).all()).results : [];
    const saved = participant ? (await db.prepare('SELECT id,name,traits,created_at FROM saved_heads WHERE participant_id=? ORDER BY created_at DESC LIMIT 10').bind(participant.id).all()).results : [];
    const snapshot = await db.prepare("SELECT value FROM settings WHERE key='leaderboardSnapshot'").first<{ value: string }>();
    const lock = await db.prepare("SELECT value FROM settings WHERE key='leaderboardLocked'").first<{ value: string }>();
    const leaderboard = lock?.value === 'true' && snapshot ? JSON.parse(snapshot.value) : (await db.prepare('SELECT display_name,xp,badge,wl_status FROM participants WHERE public_leaderboard=1 AND suspicious=0 ORDER BY xp DESC LIMIT 10').all()).results;
    return json({ participant, events, submissions, saved, leaderboard, config, challenge: attempts < 3 ? challengePublic(attempts) : null, attempts });
  } catch (cause) {
    return error(cause instanceof Error ? cause.message : 'Could not load progress', 500);
  }
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return error('Invalid request'); }
  const action = readText(body.action);
  const db = database();
  const participant = await currentParticipant(true);
  if (action === 'rarity' && !participant) {
    const choice = challengeFor(0);
    if (Number(body.id) !== choice.id) return error('That challenge has changed. Refresh to play again.');
    const answer = readText(body.answer).toLowerCase();
    if (!['common', 'uncommon', 'rare', 'legendary'].includes(answer)) return error('Choose a rarity.');
    return json({ correct: choice.rarity === answer, answer: choice.rarity, awarded: false, guest: true });
  }
  if (!participant) return error('Sign in to save progress and earn XP.', 401);
  const config = await settings();
  try {
    const taskKey = action === 'find' ? 'symbolBadge' : action === 'submit' ? readText(body.task) : action;
    if (Object.prototype.hasOwnProperty.call(config.available, taskKey) && !config.available[taskKey as keyof typeof config.available]) return error('This quest is currently unavailable.');
    switch (action) {
      case 'profile': {
        const displayName = safeDisplay(readText(body.displayName));
        const xUsername = readText(body.xUsername).trim().replace(/^@/, '');
        const walletRaw = readText(body.wallet).trim();
        const wallet = config.blockchain === 'solana' ? walletRaw : walletRaw.toLowerCase();
        if (displayName.length < 2) return error('Choose a display name with at least two characters.');
        if (xUsername && !/^[A-Za-z0-9_]{1,15}$/.test(xUsername)) return error('Enter a valid X username.');
        if (wallet && !validWallet(wallet, config.blockchain)) return error('Enter a valid wallet address.');
        await db.prepare('UPDATE participants SET display_name=?,x_username=?,wallet=?,public_leaderboard=? WHERE id=?')
          .bind(displayName, xUsername || null, wallet || null, body.publicLeaderboard ? 1 : 0, participant.id).run();
        return json({ ok: true });
      }
      case 'generate':
      case 'name':
      case 'quiz': {
        if (action === 'generate' && !validTraits(body.traits)) return error('Choose all seven traits.');
        if (action === 'name' && !readText(body.name).trim()) return error('Name your Wobblehead first.');
        if (action === 'name') {
          const generated = await db.prepare("SELECT 1 FROM xp_events WHERE participant_id=? AND event_key='generate'").bind(participant.id).first();
          if (!generated) return error('Generate a Wobblehead before naming one.');
        }
        if (action === 'quiz' && (!Array.isArray(body.answers) || body.answers.length !== 3 || !body.answers.every((answer: unknown) => Number.isInteger(answer) && Number(answer) >= 0 && Number(answer) <= 4))) return error('Answer all three quiz questions.');
        const quizResult = action === 'quiz' ? personalities[Math.round((body.answers as number[]).reduce((sum, answer) => sum + answer, 0) / 3)] : '';
        const amount = config.rewards[action];
        const awarded = await award(participant.id, action, amount, '', quizResult);
        return json({ awarded, xp: amount, result: quizResult || undefined });
      }
      case 'save': {
        const name = readText(body.name).trim().slice(0, 40);
        const traits = body.traits;
        if (!name || !validTraits(traits)) return error('Invalid Wobblehead.');
        const count = await db.prepare('SELECT COUNT(*) AS count FROM saved_heads WHERE participant_id=?').bind(participant.id).first<{ count: number }>();
        if (Number(count?.count || 0) >= 10) return error('You can save up to ten Wobbleheads.');
        await db.prepare('INSERT INTO saved_heads (id,participant_id,name,traits,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(), participant.id, name, JSON.stringify(traits), new Date().toISOString()).run();
        return json({ ok: true });
      }
      case 'rarity': {
        const answer = readText(body.answer).toLowerCase();
        if (!['common', 'uncommon', 'rare', 'legendary'].includes(answer)) return error('Choose a rarity.');
        const date = today();
        const row = await db.prepare("SELECT COUNT(*) AS count FROM xp_events WHERE participant_id=? AND event_key LIKE 'rarity:%' AND event_date=?").bind(participant.id, date).first<{ count: number }>();
        const attempt = Number(row?.count || 0);
        if (attempt >= 3) return error('You have used all three rarity guesses for today.', 429);
        const choice = challengeFor(attempt);
        if (Number(body.id) !== choice.id) return error('That challenge has changed. Refresh to play again.');
        const correct = choice.rarity === answer;
        const awarded = await award(participant.id, `rarity:${attempt}`, correct ? config.rewards.rarityCorrect : 0, date, JSON.stringify({ id: choice.id, answer }));
        return json({ correct, answer: choice.rarity, awarded, xp: correct ? config.rewards.rarityCorrect : 0, challenge: attempt < 2 ? challengePublic(attempt + 1) : null, remaining: Math.max(0, 2 - attempt) });
      }
      case 'find': {
        const symbol = Number(body.symbol);
        if (!Number.isInteger(symbol) || symbol < 1 || symbol > 7) return error('Unknown symbol.');
        const awarded = await award(participant.id, `symbol:${symbol}`, config.rewards.symbol);
        const row = await db.prepare("SELECT COUNT(*) AS count FROM xp_events WHERE participant_id=? AND event_key LIKE 'symbol:%'").bind(participant.id).first<{ count: number }>();
        const found = Number(row?.count || 0);
        if (found === 7) {
          await award(participant.id, 'symbolBadge', config.rewards.symbolBadge);
          await db.prepare("UPDATE participants SET badge='Seven Found',wl_status=CASE WHEN wl_status='none' THEN 'eligible' ELSE wl_status END WHERE id=?").bind(participant.id).run();
        }
        return json({ awarded, found, badge: found === 7 });
      }
      case 'submit': {
        const task = readText(body.task);
        if (!MANUAL_TASKS.some((key) => key === task)) return error('Unknown task.');
        if (task === 'followX' && !config.xUrl || task === 'joinDiscord' && !config.discordUrl) return error('This task opens when the official link is configured.');
        const content = readText(body.content).trim().slice(0, 500);
        if (content.length < 5) return error('Add a link or short note for review.');
        if (task === 'fanArt' && !/^https:\/\//i.test(content)) return error('Add an HTTPS link to your fan art.');
        const result = await db.prepare('INSERT OR IGNORE INTO submissions (id,participant_id,task_key,content,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(), participant.id, task, content, new Date().toISOString()).run();
        if (!result.meta.changes) return error('This task has already been submitted.');
        return json({ status: 'pending' });
      }
      case 'claim': {
        if (!participant.wallet || !validWallet(participant.wallet, config.blockchain) || !participant.x_username) return error('Add a valid wallet and X username in your profile first.');
        if (participant.xp < config.wlThreshold && participant.badge !== 'Seven Found') return error(`Earn ${config.wlThreshold} XP or find all seven symbols to become eligible.`);
        const category = readText(body.category).toLowerCase();
        if (category !== 'gtd' && category !== 'fcfs') return error('Choose a GTD or FCFS allocation.');
        const total = category === 'gtd' ? 700 : 1500;
        const result = await db.prepare(`UPDATE participants SET wl_status='pending',wl_category=? WHERE id=? AND wl_status IN ('none','eligible') AND (SELECT COUNT(*) FROM participants WHERE wl_category=? AND wl_status IN ('pending','approved')) < ?`).bind(category, participant.id, category, total).run();
        if (!result.meta.changes) {
          const latest = await db.prepare("SELECT COUNT(*) AS count FROM participants WHERE wl_category=? AND wl_status IN ('pending','approved')").bind(category).first<{ count: number }>();
          return error(Number(latest?.count || 0) >= total ? `${category.toUpperCase()} allocation is full.` : 'Your WL claim is already being processed.');
        }
        return json({ status: 'pending', category });
      }
      case 'referral': {
        const referrer = readText(body.referrer).trim();
        if (!referrer || referrer === participant.id) return error('Enter a genuine participant referral code.');
        const exists = await db.prepare('SELECT id FROM participants WHERE id=?').bind(referrer).first();
        if (!exists) return error('Referral code not found.');
        const result = await db.prepare('INSERT OR IGNORE INTO referrals (referred_id,referrer_id,created_at) VALUES (?,?,?)').bind(participant.id, referrer, new Date().toISOString()).run();
        if (!result.meta.changes) return error('A referral is already recorded for this account.');
        return json({ status: 'pending' });
      }
      default: return error('Unknown action.');
    }
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Something went wrong';
    if (message.includes('UNIQUE')) return error('That wallet or submission is already registered.');
    return error(message, 500);
  }
}
