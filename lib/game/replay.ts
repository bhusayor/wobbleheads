type Run = { seed: string; viewport_width: number; viewport_height: number; mode: string };
type Jump = { sequence: number; game_time: number };
type Obstacle = { x: number; type: 'spike' | 'crate' | 'barrel'; comboGroup?: number };

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const specs = {
  crate: { w: 92, h: 92, hx: 14, hy: 18, hw: 64, hh: 55, inset: 2 },
  barrel: { w: 82, h: 104, hx: 12, hy: 23, hw: 55, hh: 57, inset: 3 },
  spike: { w: 148, h: 93, hx: 17, hy: 31, hw: 113, hh: 42, inset: 2 },
} as const;

function seededRandom(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export function replaySurvival(run: Run, jumps: Jump[], until: number) {
  const random = seededRandom(run.seed); const width = run.viewport_width; const height = run.viewport_height;
  const mobile = run.mode === 'mobile_landscape'; const gravity = mobile ? 3450 : 4000;
  const jumpPower = mobile ? Math.sqrt(2 * gravity * Math.min(width, height) * .43) : 1580;
  const ratio = width / Math.max(height, 1);
  const pa = ratio < .72 ? { x: -.12, y: .24 } : ratio < 1.2 ? { x: .02, y: .25 } : { x: .09, y: .27 };
  const pb = ratio < .72 ? { x: 1.08, y: .86 } : ratio < 1.2 ? { x: 1, y: .85 } : { x: .94, y: .84 };
  const playerXFrac = ratio < .72 ? .22 : ratio < 1.2 ? .235 : .245;
  const groundY = (x: number) => (pa.y + (x / width - pa.x) * ((pb.y - pa.y) / (pb.x - pa.x))) * height;
  const obstacles: Obstacle[] = []; const cleared = new Set<number>();
  let time = 0, speed = 520, jumpY = 0, vy = 0, buffer = 0, onGround = true, spawnTimer = 1.05, jumpIndex = 0, group = 0;
  let boostUntil = 0, boostAmount = 0;
  const shuffle = () => { const a: Obstacle['type'][] = ['spike', 'crate', 'barrel']; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const spawn = () => {
    const x = width + 90; let span = 0; let triple = false; let pressure = false;
    if (time < 25) obstacles.push({ x, type: ['spike', 'crate', 'barrel'][Math.floor(random() * 3)] as Obstacle['type'] });
    else {
      const chance = time < 30 ? .32 : time < 33 ? .48 : time < 40 ? .68 : .74;
      pressure = time >= 30; triple = random() < chance; const order = shuffle();
      if (triple) {
        if (!mobile) { boostAmount = clamp(speed * .25, 185, 275); boostUntil = time + 3.2; }
        const adjust = clamp((speed - 700) * (mobile ? .018 : .035), 0, mobile ? 10 : 22);
        const gap1 = mobile ? (pressure ? 96 : 104) + adjust : (pressure ? 148 : 158) + adjust;
        const gap2 = mobile ? (pressure ? 102 : 110) + adjust : (pressure ? 154 : 166) + adjust;
        group++; obstacles.push({ x, type: order[0], comboGroup: group }, { x: x + gap1, type: order[1], comboGroup: group }, { x: x + gap1 + gap2, type: order[2], comboGroup: group }); span = gap1 + gap2;
      } else {
        const adjust = mobile ? clamp(108 + (speed - 700) * .025 + (pressure ? 0 : 7), 104, 132) : clamp(150 + (speed - 700) * .04 + (pressure ? 0 : 12), 145, 205);
        obstacles.push({ x, type: order[0] }, { x: x + adjust, type: order[1] }); span = adjust;
      }
    }
    const gap = time < 20 ? 2.55 : time < 25 ? 2.28 : time < 30 ? 1.95 : time < 33 ? 1.62 : time < 40 ? 1.42 : clamp(1.32 - (time - 40) * .0045, 1.02, 1.32);
    const clear = mobile ? clamp(speed * .34 + 150, 360, 520) : clamp(speed * .52 + 220, 560, 880);
    spawnTimer = Math.max(gap * (random() * .12 + .94), (span + clear) / Math.max(speed, 1));
  };
  const dt = 1 / 240;
  while (time < until + .5) {
    while (jumps[jumpIndex] && jumps[jumpIndex].game_time <= time + dt / 2) { if (onGround) { onGround = false; vy = jumpPower; buffer = 0; } else buffer = .2; jumpIndex++; }
    buffer = Math.max(0, buffer - dt); vy -= gravity * dt; jumpY += vy * dt;
    if (jumpY <= 0) { jumpY = 0; vy = 0; onGround = true; if (buffer > 0) { onGround = false; vy = jumpPower; buffer = 0; } }
    speed = time < 20 ? 520 + time * 5.2 : time < 25 ? 624 + (time - 20) * 10.5 : time < 30 ? 690 + (time - 25) * 18 : time < 33 ? 815 + (time - 30) * 29 : time < 40 ? 902 + (time - 33) * 23 : 1063 + Math.min(360, (time - 40) * 8);
    if (time < boostUntil) speed += boostAmount;
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      if (mobile && obstacles.some((item) => item.x > -180)) spawnTimer = .1;
      else spawn();
    }
    const playerX = playerXFrac * width; const g = groundY(playerX); const size = mobile ? clamp(Math.min(width, height) * .115, 36, 50) : clamp(width * .105, 62, 92);
    const left = playerX - size * .5; const bottom = height - g + jumpY - size * .49;
    const pr = { left: left + size * .17, right: left + size * .83, top: height - (bottom + size * .84), bottom: height - (bottom + size * .18) };
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obstacle = obstacles[i]; obstacle.x -= speed * dt; const spec = specs[obstacle.type];
      const scale = clamp(.82 + obstacle.x / width * .21, .76, 1.08) * (mobile ? clamp(Math.min(width, height) / 680, .52, .72) : 1);
      const gy = groundY(obstacle.x + spec.w * scale * .5); const entityBottom = height - gy - spec.inset * scale;
      const hb = { left: obstacle.x + spec.hx * scale, right: obstacle.x + (spec.hx + spec.hw) * scale, top: height - (entityBottom + (spec.hy + spec.hh) * scale), bottom: height - (entityBottom + spec.hy * scale) };
      if (pr.left < hb.right && pr.right > hb.left && pr.top < hb.bottom && pr.bottom > hb.top) {
        if (obstacle.comboGroup && mobile && (cleared.has(obstacle.comboGroup) || jumpY >= clamp(Math.min(width, height) * .095, 32, 40))) { cleared.add(obstacle.comboGroup); }
        else if (!(obstacle.comboGroup && !mobile && jumpY >= 82)) return time;
      }
      if (obstacle.x < -250) obstacles.splice(i, 1);
    }
    time += dt;
  }
  return until;
}
