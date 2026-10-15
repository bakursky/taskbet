import test from 'node:test';
import assert from 'node:assert/strict';

import { createRatchetSchedule } from '../src/spin-sound.js';

test('ratchet clicks spread out as the wheel slows down', () => {
  const clicks = createRatchetSchedule(6800, 40);
  const firstGap = clicks[1] - clicks[0];
  const lastGap = clicks.at(-1) - clicks.at(-2);

  assert.equal(clicks.length, 40);
  assert.equal(clicks[0], 0);
  assert.ok(clicks.at(-1) < 6800);
  assert.ok(lastGap > firstGap * 3);
});
