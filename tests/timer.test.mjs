import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createTimer,
  formatTime,
  getRemainingSeconds,
  parseDuration,
  pauseTimer,
  resetTimer,
  startTimer,
} from '../src/timer.js';

test('accepts positive whole-minute durations and rejects invalid input', () => {
  assert.equal(parseDuration('15'), 15);
  assert.equal(parseDuration(60), 60);
  for (const value of ['', '0', 0, '-5', '1.5', 'abc', null]) {
    assert.equal(parseDuration(value), null);
  }
});

test('creates exact preset durations in seconds', () => {
  for (const minutes of [15, 25, 45, 60]) {
    const timer = createTimer(minutes);
    assert.equal(timer.durationSeconds, minutes * 60);
    assert.equal(timer.remainingSeconds, minutes * 60);
    assert.equal(timer.running, false);
    assert.equal(timer.deadlineMs, null);
  }
});

test('derives remaining time from a deadline instead of interval ticks', () => {
  const running = startTimer(createTimer(25), 10_000);
  assert.equal(running.deadlineMs, 1_510_000);
  assert.equal(getRemainingSeconds(running, 70_000), 1_440);
  assert.equal(getRemainingSeconds(running, 1_600_000), 0);
});

test('pauses and resumes while preserving elapsed time', () => {
  const running = startTimer(createTimer(1), 1_000);
  const paused = pauseTimer(running, 21_000);
  assert.deepEqual(paused, {
    durationSeconds: 60,
    remainingSeconds: 40,
    running: false,
    deadlineMs: null,
  });
  const resumed = startTimer(paused, 50_000);
  assert.equal(resumed.deadlineMs, 90_000);
  assert.equal(getRemainingSeconds(resumed, 80_000), 10);
});

test('resets to the original duration', () => {
  const paused = pauseTimer(startTimer(createTimer(15), 0), 120_000);
  assert.deepEqual(resetTimer(paused), {
    durationSeconds: 900,
    remainingSeconds: 900,
    running: false,
    deadlineMs: null,
  });
});

test('formats countdowns as MM:SS or HH:MM:SS', () => {
  assert.equal(formatTime(0), '00:00');
  assert.equal(formatTime(65), '01:05');
  assert.equal(formatTime(3599), '59:59');
  assert.equal(formatTime(3600), '01:00:00');
  assert.equal(formatTime(3661), '01:01:01');
});
