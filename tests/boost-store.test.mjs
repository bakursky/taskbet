import test from 'node:test';
import assert from 'node:assert/strict';

import { loadBoosts, saveBoosts } from '../src/boost-store.js';

test('boost balance persists and invalid values fall back to zero', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };

  assert.equal(loadBoosts(storage), 0);
  assert.equal(saveBoosts(storage, 3), true);
  assert.equal(loadBoosts(storage), 3);
  values.set('taskbet.boosts', '-4');
  assert.equal(loadBoosts(storage), 0);
});
