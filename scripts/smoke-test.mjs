import assert from 'node:assert/strict';

const base = process.env.TEST_BASE_URL || 'http://localhost:3000';
const cookie = '__sites_local_auth=1';
const rarity = new Map([[1, 'common'], [6, 'uncommon'], [17, 'legendary'], [204, 'uncommon'], [317, 'rare'], [445, 'uncommon'], [1031, 'legendary'], [1240, 'legendary'], [1367, 'rare'], [1870, 'rare'], [2327, 'rare'], [3094, 'rare']]);

async function request(path, { auth = true, method = 'GET', body } = {}) {
  const options = { method, headers: { ...(auth ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) } };
  if (body) options.body = JSON.stringify(body);
  const response = await fetch(base + path, options);
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { response, data };
}
const get = (path, options) => request(path, options);
const post = (path, body, options) => request(path, { method: 'POST', body, ...options });

const guest = await get('/api/experience', { auth: false });
assert.equal(guest.data.participant, null);
assert.equal((await post('/api/experience', { action: 'generate', traits: [0, 0, 0, 0, 0, 0, 0] }, { auth: false })).response.status, 401);

let state = (await get('/api/experience')).data;
assert.equal(state.participant.id, 'local_seedy');
assert.equal((await post('/api/experience', { action: 'generate', traits: [0, 0, 0, 0, 0, 0, 0] })).data.awarded, true);
assert.equal((await post('/api/experience', { action: 'generate', traits: [0, 0, 0, 0, 0, 0, 0] })).data.awarded, false);
assert.equal((await post('/api/experience', { action: 'name', name: 'Little Quirk' })).data.awarded, true);
assert.equal((await post('/api/experience', { action: 'quiz', answers: [3, 3, 3] })).data.awarded, true);
assert.equal((await post('/api/experience', { action: 'quiz', answers: [3, 3, 3] })).data.awarded, false);
assert.equal((await post('/api/experience', { action: 'save', name: 'Little Quirk', traits: [0, 0, 0, 0, 0, 0, 0] })).response.status, 200);

for (let attempt = 0; attempt < 3; attempt++) {
  state = (await get('/api/experience')).data;
  const challenge = state.challenge;
  assert.ok(challenge);
  const outcome = await post('/api/experience', { action: 'rarity', id: challenge.id, answer: rarity.get(challenge.id) });
  assert.equal(outcome.data.correct, true);
  assert.equal(outcome.data.awarded, true);
}
assert.equal((await post('/api/experience', { action: 'rarity', id: 1, answer: 'common' })).response.status, 429);

for (let symbol = 1; symbol <= 7; symbol++) {
  const outcome = await post('/api/experience', { action: 'find', symbol });
  assert.equal(outcome.data.found, symbol);
}
assert.equal((await post('/api/experience', { action: 'find', symbol: 1 })).data.awarded, false);

const wallet = `0x${'1'.repeat(40)}`;
assert.equal((await post('/api/experience', { action: 'profile', displayName: 'Test Wobbler', xUsername: 'wobbletest', wallet, publicLeaderboard: true })).response.status, 200);
assert.equal((await post('/api/experience', { action: 'claim' })).data.status, 'pending');
assert.equal((await post('/api/experience', { action: 'submit', task: 'fanArt', content: 'https://example.com/wobble-art.png' })).data.status, 'pending');
assert.equal((await post('/api/experience', { action: 'submit', task: 'fanArt', content: 'https://example.com/wobble-art.png' })).response.status, 400);
assert.equal((await get('/api/admin', { auth: false })).response.status, 403);

const admin = await get('/api/admin');
assert.equal(admin.response.status, 200);
const submission = admin.data.submissions.find((item) => item.task_key === 'fanArt');
assert.ok(submission);
assert.equal((await post('/api/admin', { action: 'review', id: submission.id, status: 'approved' })).response.status, 200);
assert.equal((await post('/api/admin', { action: 'wl', id: 'local_seedy', status: 'approved', category: 'Community WL' })).response.status, 200);
assert.equal((await post('/api/admin', { action: 'setting', key: 'leaderboardLocked', value: 'true' })).response.status, 200);
assert.equal((await post('/api/admin', { action: 'setting', key: 'resultsPublished', value: 'true' })).response.status, 200);
assert.equal((await post('/api/admin', { action: 'setting', key: 'task.generate', value: 'false' })).response.status, 200);
assert.equal((await post('/api/experience', { action: 'generate', traits: [0, 0, 0, 0, 0, 0, 0] })).response.status, 400);
assert.equal((await post('/api/admin', { action: 'setting', key: 'task.generate', value: 'true' })).response.status, 200);

const history = await get('/api/admin?history=local_seedy');
assert.ok(history.data.events.some((event) => event.event_key === 'symbolBadge'));
const csv = await get('/api/admin?export=winners');
assert.match(csv.response.headers.get('content-type'), /text\/csv/);
assert.match(csv.data, /Community WL/);
const wallets = await get('/api/admin?export=wallets');
assert.match(wallets.data, /0x1111/);
const results = await get('/results', { auth: false });
assert.equal(results.response.status, 200);
assert.ok(results.data.includes('Community WL'));
assert.ok(!results.data.includes('seedy@sites.test'));

state = (await get('/api/experience')).data;
assert.equal(state.participant.wl_status, 'approved');
assert.equal(state.participant.badge, 'Seven Found');
assert.equal(state.participant.xp, 145);
console.log('Smoke test passed: duplicate XP, rarity limits, seven symbols, WL approval, task review, privacy, and CSV export.');
