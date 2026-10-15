import test from 'node:test';
import assert from 'node:assert/strict';

import { chooseSpin, describeSector, getWinningIndex } from '../src/wheel.js';

test('describes valid closed SVG sectors for one, two, and seven slices', () => {
  for (const count of [1, 2, 7]) {
    for (let index = 0; index < count; index += 1) {
      const path = describeSector(index, count, 180);
      assert.match(path, /^M /);
      assert.match(path, / A /);
      assert.match(path, / Z$/);
      assert.equal(path.includes('NaN'), false);
    }
  }
});

test('maps representative rotations to a winning index inside the wheel', () => {
  assert.equal(getWinningIndex(0, 4), 0);
  assert.equal(getWinningIndex(269, 4), 1);
  assert.equal(getWinningIndex(181, 4), 1);
  assert.equal(getWinningIndex(90, 4), 3);
  for (const degrees of [-720, -91, 0, 47, 359, 721, 9999]) {
    const index = getWinningIndex(degrees, 7);
    assert.ok(index >= 0 && index < 7);
  }
});

test('chooses deterministic targets with injected random values', () => {
  const first = chooseSpin(0, 4, () => 0);
  assert.equal(first.winningIndex, 0);
  assert.equal(getWinningIndex(first.finalDegrees, 4), 0);
  assert.ok(first.finalDegrees >= 5 * 360);

  const last = chooseSpin(150, 4, () => 0.999999);
  assert.equal(last.winningIndex, 3);
  assert.equal(getWinningIndex(last.finalDegrees, 4), 3);
  assert.ok(last.finalDegrees > 150 + 7 * 360);
});

test('always selects the only active task', () => {
  for (const random of [0, 0.4, 0.999]) {
    const spin = chooseSpin(33, 1, () => random);
    assert.equal(spin.winningIndex, 0);
    assert.equal(getWinningIndex(spin.finalDegrees, 1), 0);
  }
});
