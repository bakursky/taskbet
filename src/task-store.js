export const STORAGE_KEY = 'spinflow.tasks';

export const PALETTE = [
  '#8298FF',
  '#FF83B5',
  '#49D9AA',
  '#FFBF3F',
  '#AB7BFF',
  '#3BC7EA',
  '#FF7C58',
  '#BADA42',
];

export const SAMPLE_TASKS = [
  { id: 'sample-1', title: 'Ответить на письма', color: PALETTE[0], completed: false, rewarded: false },
  { id: 'sample-2', title: 'Доделать презентацию', color: PALETTE[1], completed: false, rewarded: false },
  { id: 'sample-3', title: 'Пройтись 20 минут', color: PALETTE[2], completed: false, rewarded: false },
  { id: 'sample-4', title: 'Разобрать рабочий стол', color: PALETTE[3], completed: false, rewarded: false },
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
  return { id, title: normalized, color, completed: false, rewarded: false };
}

export function getActiveTasks(tasks) {
  return tasks.filter((task) => !task.completed);
}

export function toggleTask(tasks, id) {
  return tasks.map((task) => task.id === id ? { ...task, completed: !task.completed } : task);
}

export function completeTaskWithReward(tasks, id) {
  let earned = false;
  const nextTasks = tasks.map((task) => {
    if (task.id !== id || task.completed) return task;
    earned = !task.rewarded;
    return { ...task, completed: true, rewarded: true };
  });
  return { tasks: nextTasks, earned };
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
    if (!storage) return cloneSamples();
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return cloneSamples();
    const tasks = JSON.parse(raw);
    if (!Array.isArray(tasks) || !tasks.every(isValidTask)) return cloneSamples();
    return tasks.map((task) => ({ ...task, title: normalizeTitle(task.title), rewarded: Boolean(task.rewarded) }));
  } catch {
    return cloneSamples();
  }
}

export function saveTasks(storage, tasks) {
  try {
    if (!storage) return false;
    storage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    return true;
  } catch {
    return false;
  }
}
