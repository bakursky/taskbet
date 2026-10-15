import {
  PALETTE,
  createTask,
  getActiveTasks,
  loadTasks,
  removeTask,
  saveTasks,
  toggleTask,
} from './task-store.js';
import { MAX_SPIN_DURATION_MS, SPIN_DURATION_MS, chooseBoost, chooseSpin, extendSpinDeadline, renderWheel } from './wheel.js';
import { playRatchet } from './spin-sound.js';
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
  modal: document.querySelector('#selection-modal'),
  result: document.querySelector('#result-modal-panel'),
  selection: document.querySelector('#selection-panel'),
  confetti: document.querySelector('#confetti-layer'),
  wheel: document.querySelector('#wheel'),
  wheelStage: document.querySelector('.wheel-stage'),
};

function getBrowserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const storage = getBrowserStorage();
let tasks = loadTasks(storage);
let rotationDegrees = 0;
let selectedTaskId = null;
let isSpinning = false;
let timerState = null;
let timerInterval = null;
let confettiTimeout = null;
let spinSession = null;
let spinFinishTimeout = null;

const REACTIONS = [
  'Ура! Погнали.',
  'Фу… зато потом будет легче.',
  'Выпало — значит судьба.',
  'Погнали! Без отговорок.',
];

function taskWord(count) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'задача';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'задачи';
  return 'задач';
}

function persistAndRender(message = '') {
  const persisted = saveTasks(storage, tasks);
  renderTasks();
  if (!persisted) {
    elements.status.textContent = `${message ? `${message}. ` : ''}Изменения не сохранятся после закрытия вкладки`;
  } else if (message) {
    elements.status.textContent = message;
  }
}

function setMutationControls(disabled) {
  elements.input.disabled = disabled;
  elements.form.querySelector('button').disabled = disabled;
  elements.list.querySelectorAll('.task-check, .task-delete').forEach((button) => {
    button.disabled = disabled;
  });
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
    const check = document.createElement('button');
    check.className = 'task-check';
    check.type = 'button';
    check.dataset.action = 'toggle';
    check.setAttribute('aria-label', task.completed ? 'Вернуть' : 'Отметить готовой');
    const marker = document.createElement('span');
    marker.textContent = task.completed ? '✓' : String(index + 1).padStart(2, '0');
    check.append(marker);

    const title = document.createElement('span');
    title.className = 'task-title';
    title.textContent = task.title;

    const remove = document.createElement('button');
    remove.className = 'task-delete';
    remove.type = 'button';
    remove.dataset.action = 'delete';
    remove.setAttribute('aria-label', `Удалить ${task.title}`);
    remove.textContent = '×';
    row.append(check, title, remove);
    elements.list.append(row);
  });

  const done = tasks.length - active.length;
  elements.activeCount.textContent = `${active.length} ${taskWord(active.length)}`;
  elements.summary.textContent = tasks.length ? `${done} из ${tasks.length} выполнено` : 'Колесо ждёт';
  elements.progress.style.width = tasks.length ? `${done / tasks.length * 100}%` : '0%';
  elements.spin.disabled = active.length === 0 || Boolean(isSpinning && spinSession?.deadline >= spinSession?.startedAt + MAX_SPIN_DURATION_MS);
  renderWheel(elements.wheel, active, rotationDegrees);
  setMutationControls(isSpinning);
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

function renderEmptyTimer() {
  elements.selection.hidden = false;
  elements.selection.innerHTML = `
    <div class="focus-task timer-empty-state">
      <span class="focus-dot"></span>
      <div><span>Фокус-таймер</span><strong>Ставок нет</strong></div>
    </div>`;
}

function clearSelection() {
  stopTicker();
  selectedTaskId = null;
  timerState = null;
  elements.modal.hidden = true;
  elements.result.hidden = true;
  elements.result.replaceChildren();
  renderEmptyTimer();
  document.body.classList.remove('modal-open');
}

function showSelection(task) {
  elements.modal.hidden = false;
  elements.result.hidden = false;
  elements.selection.hidden = false;
  timerState = null;
  elements.result.innerHTML = `
    <button class="modal-close" type="button" data-modal-close aria-label="Закрыть">×</button>
    <div class="focus-task">
      <span class="focus-dot"></span>
      <div><span>Тебе выпало</span><strong data-selected-title></strong><em class="focus-reaction"></em></div>
    </div>
    <button class="confirm-task" type="button" data-confirm-task>Включить таймер <span>→</span></button>`;
  elements.result.querySelector('.focus-dot').style.setProperty('--selection-color', task.color);
  elements.result.querySelector('[data-selected-title]').textContent = task.title;
  elements.result.querySelector('.focus-reaction').textContent = REACTIONS[Math.floor(Math.random() * REACTIONS.length)];
  document.body.classList.add('modal-open');
  celebrate();
  elements.result.querySelector('[data-confirm-task]')?.focus({ preventScroll: true });
}

function showDurationPicker(task) {
  elements.modal.hidden = true;
  elements.result.hidden = true;
  elements.result.replaceChildren();
  document.body.classList.remove('modal-open');
  elements.selection.hidden = false;
  elements.selection.innerHTML = `
    <div class="focus-task compact-focus-task">
      <span class="focus-dot"></span>
      <div><span>Твоя задача</span><strong data-selected-title></strong></div>
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
  elements.selection.querySelector('.focus-dot').style.setProperty('--selection-color', task.color);
  elements.selection.querySelector('[data-selected-title]').textContent = task.title;
  elements.selection.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
  elements.selection.querySelector('[data-duration]')?.focus({ preventScroll: true });
}

function celebrate() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (confettiTimeout) window.clearTimeout(confettiTimeout);
  elements.confetti.replaceChildren();
  const colors = [...PALETTE, '#F6F8FF'];
  for (let index = 0; index < 44; index += 1) {
    const piece = document.createElement('i');
    piece.className = 'confetti-piece';
    piece.style.setProperty('--x', `${8 + Math.random() * 84}vw`);
    piece.style.setProperty('--drift', `${(Math.random() - 0.5) * 260}px`);
    piece.style.setProperty('--spin', `${360 + Math.random() * 900}deg`);
    piece.style.setProperty('--delay', `${Math.random() * 0.3}s`);
    piece.style.setProperty('--duration', `${1.8 + Math.random() * 1.2}s`);
    piece.style.setProperty('--confetti-color', colors[index % colors.length]);
    elements.confetti.append(piece);
  }
  confettiTimeout = window.setTimeout(() => elements.confetti.replaceChildren(), 3400);
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
  let card = elements.selection.querySelector('.timer-card');
  if (!card) {
    elements.selection.innerHTML = `
      <div class="timer-card">
        <div class="timer-meta"><span class="focus-dot"></span><div><span data-timer-state></span><strong data-timer-task></strong></div></div>
        <div class="timer-display"><div><strong data-timer-value></strong><span data-timer-caption></span></div></div>
        <div class="timer-actions">
          <button class="timer-secondary timer-toggle" type="button" data-timer-action="pause"></button>
          <button class="timer-secondary" type="button" data-timer-action="reset">Сбросить</button>
          <button class="timer-primary" type="button" data-timer-action="complete">✓ Готово</button>
        </div>
      </div>`;
    card = elements.selection.querySelector('.timer-card');
  }
  card.querySelector('.focus-dot').style.setProperty('--selection-color', task.color);
  card.querySelector('[data-timer-state]').textContent = remaining === 0 ? 'Фокус-сессия завершена' : 'Сейчас в фокусе';
  card.querySelector('[data-timer-task]').textContent = task.title;
  card.querySelector('.timer-display').style.setProperty('--timer-progress', `${progress * 360}deg`);
  card.querySelector('[data-timer-value]').textContent = formatTime(remaining);
  card.querySelector('[data-timer-caption]').textContent = timerState.running ? 'не отвлекайся' : remaining === 0 ? 'готово' : 'пауза';
  const toggle = card.querySelector('.timer-toggle');
  toggle.hidden = remaining === 0;
  toggle.dataset.timerAction = timerState.running ? 'pause' : 'resume';
  toggle.textContent = timerState.running ? 'Пауза' : 'Продолжить';
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

elements.result.addEventListener('click', (event) => {
  if (event.target.closest('[data-modal-close]')) {
    clearSelection();
    return;
  }
  if (event.target.closest('[data-confirm-task]')) {
    const task = tasks.find(({ id }) => id === selectedTaskId);
    if (task) showDurationPicker(task);
  }
});

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
  window.clearTimeout(spinFinishTimeout);
  spinFinishTimeout = null;
  spinSession = null;
  isSpinning = false;
  elements.spin.querySelector('span').textContent = 'Крутить колесо';
  if (!getActiveTasks(tasks).some(({ id }) => id === task.id)) {
    elements.wheel.classList.remove('is-spinning');
    elements.wheelStage.classList.remove('is-spinning');
    renderTasks();
    elements.status.textContent = 'Список задач изменился — крутани ещё раз';
    return;
  }
  selectedTaskId = task.id;
  elements.wheel.classList.remove('is-spinning');
  elements.wheelStage.classList.remove('is-spinning');
  renderTasks();
  showSelection(task);
  elements.status.textContent = `Выбрана задача: ${task.title}`;
}

function currentWheelDegrees() {
  const transform = getComputedStyle(elements.wheel).transform;
  if (!transform || transform === 'none') return 0;
  const values = transform.match(/matrix\(([^)]+)\)/)?.[1].split(',').map(Number);
  return values ? Math.atan2(values[1], values[0]) * 180 / Math.PI : 0;
}

function animateSpin(targetDegrees, durationMs) {
  const currentDegrees = currentWheelDegrees();
  elements.wheel.classList.remove('is-spinning');
  elements.wheel.style.transform = `rotate(${currentDegrees}deg)`;
  elements.wheel.getBoundingClientRect();
  elements.wheel.style.setProperty('--spin-duration', `${durationMs}ms`);
  elements.wheel.classList.add('is-spinning');
  requestAnimationFrame(() => {
    elements.wheel.style.transform = `rotate(${targetDegrees}deg)`;
  });
}

function scheduleSpinFinish(task, delayMs) {
  window.clearTimeout(spinFinishTimeout);
  spinFinishTimeout = window.setTimeout(() => finishSpin(task), delayMs + 80);
}

function boostSpin(active) {
  const now = performance.now();
  spinSession.deadline = extendSpinDeadline(spinSession.startedAt, spinSession.deadline);
  const remainingMs = Math.max(120, spinSession.deadline - now);
  const boost = chooseBoost(currentWheelDegrees(), active.length);
  rotationDegrees = boost.finalDegrees;
  const task = active[boost.winningIndex];
  spinSession.task = task;
  elements.spin.disabled = spinSession.deadline >= spinSession.startedAt + MAX_SPIN_DURATION_MS;
  animateSpin(rotationDegrees, remainingMs);
  playRatchet(remainingMs);
  scheduleSpinFinish(task, remainingMs);
  elements.status.textContent = elements.spin.disabled ? 'Максимум — 10 секунд' : 'Подкручено!';
}

function spinWheel() {
  const active = getActiveTasks(tasks);
  if (!active.length) return;
  if (isSpinning) {
    if (!elements.spin.disabled) boostSpin(active);
    return;
  }
  clearSelection();
  isSpinning = true;
  elements.spin.disabled = false;
  elements.spin.querySelector('span').textContent = 'Подкрутить';
  setMutationControls(true);
  const spin = chooseSpin(rotationDegrees, active.length);
  rotationDegrees = spin.finalDegrees;
  const task = active[spin.winningIndex];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const startedAt = performance.now();
  spinSession = { startedAt, deadline: startedAt + SPIN_DURATION_MS, task };

  if (reducedMotion) {
    elements.wheel.style.transform = `rotate(${rotationDegrees}deg)`;
    finishSpin(task);
    return;
  }

  elements.wheelStage.classList.add('is-spinning');
  playRatchet(SPIN_DURATION_MS);
  animateSpin(rotationDegrees, SPIN_DURATION_MS);
  scheduleSpinFinish(task, SPIN_DURATION_MS);
}

elements.wheel.style.setProperty('--spin-duration', `${SPIN_DURATION_MS}ms`);
elements.spin.addEventListener('click', spinWheel);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !elements.modal.hidden) {
    clearSelection();
    return;
  }
  if (event.code === 'Space' && !/INPUT|TEXTAREA|BUTTON/.test(document.activeElement.tagName)) {
    event.preventDefault();
    spinWheel();
  }
});

renderEmptyTimer();
renderTasks();
