export const STORAGE_KEY = 'spinflow.tasks';

export const PALETTE = [
  '#B9C5FF',
  '#F4C6D7',
  '#A8E6CF',
  '#F7D9A7',
  '#C9B8F4',
  '#9ED9E8',
  '#F2B6A0',
  '#D8E5A6',
];

export const SAMPLE_TASKS = [
  { id: 'sample-1', title: 'Ответить на письма', color: PALETTE[0], completed: false },
  { id: 'sample-2', title: 'Доделать презентацию', color: PALETTE[1], completed: false },
  { id: 'sample-3', title: 'Пройтись 20 минут', color: PALETTE[2], completed: false },
  { id: 'sample-4', title: 'Разобрать рабочий стол', color: PALETTE[3], completed: false },
];

const cloneSamples = () => SAMPLE_TASKS.map((task) => ({ ...task }));

export function normalizeTitle(value) {
  return typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ').slice(0, 80)
    : '';
}

export function createTask(title, color, id = crypto.randomUUID()) {
  const normalized = normalizeTitle(title);
  if (!normalized) throw new Error('Task title cannot be empty');
  return { id, title: normalized, color, completed: false };
}

export function getActiveTasks(tasks) {
  return tasks.filter((task) => !task.completed);
}

export function toggleTask(tasks, id) {
  return tasks.map((task) => task.id === id ? { ...task, completed: !task.completed } : task);
}

export function removeTask(tasks, id) {
  return tasks.filter((task) => task.id !== id);
}

function isValidTask(task) {
  return task && typeof task.id === 'string' && normalizeTitle(task.title)
    && typeof task.color === 'string' && typeof task.completed === 'boolean';
}

export function loadTasks(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return cloneSamples();
    const tasks = JSON.parse(raw);
    if (!Array.isArray(tasks) || !tasks.every(isValidTask)) return cloneSamples();
    return tasks.map((task) => ({ ...task, title: normalizeTitle(task.title) }));
  } catch {
    return cloneSamples();
  }
}

export function saveTasks(storage, tasks) {
  storage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}
