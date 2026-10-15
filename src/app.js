import {
  PALETTE,
  createTask,
  getActiveTasks,
  loadTasks,
  removeTask,
  saveTasks,
  toggleTask,
} from './task-store.js';
import { chooseSpin, renderWheel } from './wheel.js';
import {
  createTimer,
  formatTime,
  getRemainingSeconds,
  parseDuration,
  pauseTimer,
  resetTimer,
  startTimer,
} from './timer.js';

const elements = {
  activeCount: document.querySelector('#active-count'),
  form: document.querySelector('#task-form'),
  input: document.querySelector('#task-input'),
  list: document.querySelector('#task-list'),
  spin: document.querySelector('#spin-button'),
  status: document.querySelector('#status'),
  summary: document.querySelector('#summary-copy'),
  progress: document.querySelector('#summary-progress'),
  selection: document.querySelector('#selection-panel'),
  wheel: document.querySelector('#wheel'),
  wheelStage: document.querySelector('.wheel-stage'),
};

let tasks = loadTasks(localStorage);
let rotationDegrees = 0;
let selectedTaskId = null;
let isSpinning = false;
let timerState = null;
let timerInterval = null;

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
  if (selectedTaskId && !active.some((task) => task.id === selectedTaskId)) clearSelection();
  elements.list.replaceChildren();

  if (!tasks.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = '<span>✦</span><strong>Добавь первую задачу</strong><small>И она сразу появится на колесе</small>';
    elements.list.append(empty);
  }

  tasks.forEach((task, index) => {
    const row = document.createElement('div');
    row.className = `task-row${task.completed ? ' is-complete' : ''}${task.id === selectedTaskId ? ' is-selected' : ''}`;
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
  elements.spin.disabled = active.length === 0 || isSpinning;
  renderWheel(elements.wheel, active, rotationDegrees);
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

function clearSelection() {
  stopTicker();
  selectedTaskId = null;
  timerState = null;
  elements.selection.hidden = true;
  elements.selection.replaceChildren();
}

function showSelection(task) {
  elements.selection.hidden = false;
  timerState = null;
  elements.selection.innerHTML = `
    <div class="focus-task">
      <span class="focus-dot" style="--selection-color:${task.color}"></span>
      <div><span>Колесо решило</span><strong>${escapeHtml(task.title)}</strong></div>
    </div>
    <div class="duration-picker">
      <span class="duration-label">Сколько фокуса?</span>
      <div class="duration-options">
        ${[15, 25, 45, 60].map((value) => `<button type="button" data-duration="${value}">${value}<small>мин</small></button>`).join('')}
      </div>
      <form class="custom-duration">
        <label for="custom-duration-input">Своё время</label>
        <div><input id="custom-duration-input" inputmode="numeric" min="1" step="1" placeholder="30"><span>мин</span><button type="submit">Начать</button></div>
      </form>
    </div>`;
  elements.selection.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
}

function renderTimer() {
  const task = tasks.find(({ id }) => id === selectedTaskId);
  if (!task || !timerState) return;
  const remaining = getRemainingSeconds(timerState);
  if (timerState.running && remaining === 0) {
    timerState = pauseTimer(timerState);
    stopTicker();
  }
  const progress = timerState.durationSeconds ? remaining / timerState.durationSeconds : 0;
  elements.selection.hidden = false;
  elements.selection.innerHTML = `
    <div class="timer-card">
      <div class="timer-meta"><span class="focus-dot" style="--selection-color:${task.color}"></span><div><span>${remaining === 0 ? 'Фокус-сессия завершена' : 'Сейчас в фокусе'}</span><strong>${escapeHtml(task.title)}</strong></div></div>
      <div class="timer-display" style="--timer-progress:${progress * 360}deg">
        <div><strong data-timer-value>${formatTime(remaining)}</strong><span>${timerState.running ? 'не отвлекайся' : remaining === 0 ? 'готово' : 'пауза'}</span></div>
      </div>
      <div class="timer-actions">
        ${remaining > 0 ? `<button class="timer-secondary" type="button" data-timer-action="${timerState.running ? 'pause' : 'resume'}">${timerState.running ? 'Пауза' : 'Продолжить'}</button>` : ''}
        <button class="timer-secondary" type="button" data-timer-action="reset">Сбросить</button>
        <button class="timer-primary" type="button" data-timer-action="complete">✓ Готово</button>
      </div>
    </div>`;
}

function stopTicker() {
  if (timerInterval) window.clearInterval(timerInterval);
  timerInterval = null;
}

function startTicker() {
  stopTicker();
  timerInterval = window.setInterval(() => {
    renderTimer();
    if (!timerState?.running) stopTicker();
  }, 250);
}

function beginFocus(value) {
  const minutes = parseDuration(value);
  if (minutes === null) {
    elements.status.textContent = 'Укажи целое число минут больше нуля';
    elements.selection.querySelector('#custom-duration-input')?.focus();
    return;
  }
  timerState = startTimer(createTimer(minutes));
  renderTimer();
  startTicker();
  elements.status.textContent = `Таймер запущен на ${minutes} минут`;
}

elements.selection.addEventListener('click', (event) => {
  const duration = event.target.closest('[data-duration]');
  if (duration) beginFocus(duration.dataset.duration);

  const action = event.target.closest('[data-timer-action]')?.dataset.timerAction;
  if (!action || !timerState) return;
  if (action === 'pause') {
    timerState = pauseTimer(timerState);
    stopTicker();
  }
  if (action === 'resume') {
    timerState = startTimer(timerState);
    startTicker();
  }
  if (action === 'reset') {
    timerState = resetTimer(timerState);
    stopTicker();
  }
  if (action === 'complete') {
    tasks = toggleTask(tasks, selectedTaskId);
    clearSelection();
    persistAndRender('Отлично! Задача выполнена');
    return;
  }
  renderTimer();
});

elements.selection.addEventListener('submit', (event) => {
  if (!event.target.matches('.custom-duration')) return;
  event.preventDefault();
  beginFocus(event.target.querySelector('input').value);
});

function finishSpin(task) {
  isSpinning = false;
  selectedTaskId = task.id;
  elements.wheel.classList.remove('is-spinning');
  elements.wheelStage.classList.remove('is-spinning');
  renderTasks();
  showSelection(task);
  elements.status.textContent = `Выбрана задача: ${task.title}`;
}

function spinWheel() {
  const active = getActiveTasks(tasks);
  if (isSpinning || !active.length) return;
  clearSelection();
  isSpinning = true;
  elements.spin.disabled = true;
  const spin = chooseSpin(rotationDegrees, active.length);
  rotationDegrees = spin.finalDegrees;
  const task = active[spin.winningIndex];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  elements.wheel.classList.toggle('is-spinning', !reducedMotion);
  elements.wheelStage.classList.toggle('is-spinning', !reducedMotion);
  requestAnimationFrame(() => {
    elements.wheel.style.transform = `rotate(${rotationDegrees}deg)`;
  });

  if (reducedMotion) {
    finishSpin(task);
    return;
  }

  let finished = false;
  const complete = () => {
    if (finished) return;
    finished = true;
    finishSpin(task);
  };
  elements.wheel.addEventListener('transitionend', complete, { once: true });
  window.setTimeout(complete, 4700);
}

elements.spin.addEventListener('click', spinWheel);
document.addEventListener('keydown', (event) => {
  if (event.code === 'Space' && !/INPUT|TEXTAREA|BUTTON/.test(document.activeElement.tagName)) {
    event.preventDefault();
    spinWheel();
  }
});

renderTasks();
