import assert from 'node:assert/strict';
import test from 'node:test';
import { replaySurvival } from './replay';

const desktop = { seed: '00000000-0000-4000-8000-000000000001', viewport_width: 1440, viewport_height: 900, mode: 'desktop' };
const mobile = { seed: '00000000-0000-4000-8000-000000000002', viewport_width: 844, viewport_height: 390, mode: 'mobile_landscape' };

void test('an untouched desktop run collides before FCFS', () => {
  assert.ok(replaySurvival(desktop, [], 45) < 45);
});

void test('an untouched mobile run collides before FCFS', () => {
  assert.ok(replaySurvival(mobile, [], 45) < 45);
});

void test('the same seed and inputs always produce the same result', () => {
  const jumps = Array.from({ length: 20 }, (_, index) => ({ sequence: index + 1, game_time: 1.7 + index * 2.1 }));
  assert.equal(replaySurvival(desktop, jumps, 45), replaySurvival(desktop, jumps, 45));
});

void test('replay supports common browser display rates', () => {
  const jumps = Array.from({ length: 20 }, (_, index) => ({ sequence: index + 1, game_time: 1.7 + index * 2.1 }));
  for (const hz of [30, 60, 90, 120, 144, 165, 240]) {
    assert.ok(Number.isFinite(replaySurvival(desktop, jumps, 45, hz)));
  }
});

void test('client supplied survival cannot override a replay collision', () => {
  assert.ok(replaySurvival(desktop, [], 60) < 60);
});
