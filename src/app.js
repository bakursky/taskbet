import {
  PALETTE,
  createTask,
  getActiveTasks,
  loadTasks,
  removeTask,
  saveTasks,
  toggleTask,
} from './task-store.js';

const elements = {
  activeCount: document.querySelector('#active-count'),
  form: document.querySelector('#task-form'),
  input: document.querySelector('#task-input'),
  list: document.querySelector('#task-list'),
  spin: document.querySelector('#spin-button'),
  status: document.querySelector('#status'),
  summary: document.querySelector('#summary-copy'),
  progress: document.querySelector('#summary-progress'),
};

let tasks = loadTasks(localStorage);

function taskWord(count) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'задача';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'задачи';
  return 'задач';
}

function persistAndRender(message = '') {
  saveTasks(localStorage, tasks);
  renderTasks();
  if (message) elements.status.textContent = message;
}

function renderTasks() {
  const active = getActiveTasks(tasks);
  elements.list.replaceChildren();

  if (!tasks.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = '<span>✦</span><strong>Добавь первую задачу</strong><small>И она сразу появится на колесе</small>';
    elements.list.append(empty);
  }

  tasks.forEach((task, index) => {
    const row = document.createElement('div');
    row.className = `task-row${task.completed ? ' is-complete' : ''}`;
    row.dataset.taskId = task.id;
    row.style.setProperty('--task-color', task.color);
    row.innerHTML = `
      <button class="task-check" type="button" data-action="toggle" aria-label="${task.completed ? 'Вернуть' : 'Отметить готовой'}">
        <span>${task.completed ? '✓' : String(index + 1).padStart(2, '0')}</span>
      </button>
      <span class="task-title">${escapeHtml(task.title)}</span>
      <button class="task-delete" type="button" data-action="delete" aria-label="Удалить ${escapeHtml(task.title)}">×</button>`;
    elements.list.append(row);
  });

  const done = tasks.length - active.length;
  elements.activeCount.textContent = `${active.length} ${taskWord(active.length)}`;
  elements.summary.textContent = tasks.length ? `${done} из ${tasks.length} выполнено` : 'Колесо ждёт';
  elements.progress.style.width = tasks.length ? `${done / tasks.length * 100}%` : '0%';
  elements.spin.disabled = active.length === 0;
}

function escapeHtml(value) {
  const span = document.createElement('span');
  span.textContent = value;
  return span.innerHTML;
}

elements.form.addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    const task = createTask(elements.input.value, PALETTE[tasks.length % PALETTE.length]);
    tasks = [...tasks, task];
    elements.input.value = '';
    persistAndRender(`Добавлена задача: ${task.title}`);
  } catch {
    elements.status.textContent = 'Введи название задачи';
    elements.input.focus();
  }
});

elements.list.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  const row = event.target.closest('[data-task-id]');
  if (!button || !row) return;
  if (button.dataset.action === 'toggle') tasks = toggleTask(tasks, row.dataset.taskId);
  if (button.dataset.action === 'delete') tasks = removeTask(tasks, row.dataset.taskId);
  persistAndRender(button.dataset.action === 'delete' ? 'Задача удалена' : 'Статус задачи изменён');
});

renderTasks();
