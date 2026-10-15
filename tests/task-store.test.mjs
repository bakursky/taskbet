import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PALETTE,
  SAMPLE_TASKS,
  createTask,
  getActiveTasks,
  loadTasks,
  normalizeTitle,
  removeTask,
  saveTasks,
  toggleTask,
} from '../src/task-store.js';

const memoryStorage = (initial = {}) => {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
};

test('normalizes whitespace and caps task titles at 80 characters', () => {
  assert.equal(normalizeTitle('  Сделать   презентацию  '), 'Сделать презентацию');
  assert.equal(normalizeTitle('a'.repeat(90)).length, 80);
  assert.equal(normalizeTitle(null), '');
});

test('creates a serializable task and rejects blank titles', () => {
  assert.deepEqual(createTask('  Ответить на письма ', '#B9C5FF', 'task-1'), {
    id: 'task-1',
    title: 'Ответить на письма',
    color: '#B9C5FF',
    completed: false,
  });
  assert.throws(() => createTask('   ', '#B9C5FF'), /empty/i);
});

test('filters active tasks and toggles tasks without mutating input', () => {
  const tasks = [
    { id: '1', title: 'A', color: '#fff', completed: false },
    { id: '2', title: 'B', color: '#000', completed: true },
  ];
  const toggled = toggleTask(tasks, '1');
  assert.deepEqual(getActiveTasks(tasks).map(({ id }) => id), ['1']);
  assert.equal(tasks[0].completed, false);
  assert.equal(toggled[0].completed, true);
});

test('removes a task without mutating input', () => {
  const tasks = [
    { id: '1', title: 'A', color: '#fff', completed: false },
    { id: '2', title: 'B', color: '#000', completed: false },
  ];
  assert.deepEqual(removeTask(tasks, '1').map(({ id }) => id), ['2']);
  assert.equal(tasks.length, 2);
});

test('persists valid tasks and restores the same values', () => {
  const storage = memoryStorage();
  const tasks = [{ id: '1', title: 'Задача', color: '#A8E6CF', completed: false }];
  saveTasks(storage, tasks);
  assert.deepEqual(loadTasks(storage), tasks);
});

test('migrates saved tasks from the previous palette to vivid colors', () => {
  const stored = [
    { id: '1', title: 'Первая', color: '#8298FF', completed: false },
    { id: '2', title: 'Вторая', color: '#FF83B5', completed: true },
  ];
  const storage = memoryStorage({ 'spinflow.tasks': JSON.stringify(stored) });

  assert.deepEqual(loadTasks(storage).map(({ color }) => color), ['#5B7CFF', '#FF3D8D']);
  assert.equal(PALETTE[0], '#5B7CFF');
});

test('falls back to a fresh copy of sample tasks for corrupt storage', () => {
  const storage = memoryStorage({ 'spinflow.tasks': '{not-json' });
  const loaded = loadTasks(storage);
  assert.deepEqual(loaded, SAMPLE_TASKS);
  assert.notEqual(loaded, SAMPLE_TASKS);
});
