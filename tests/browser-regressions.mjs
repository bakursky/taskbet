import test from 'node:test';
import assert from 'node:assert/strict';

const DEBUG_URL = process.env.CDP_URL || 'http://127.0.0.1:9223';
const APP_ORIGIN = process.env.APP_ORIGIN || 'http://localhost:4173';
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getTarget() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const targets = await fetch(`${DEBUG_URL}/json`).then((response) => response.json());
      const target = targets.find((item) => item.type === 'page' && item.url.includes('localhost:4173'));
      if (target) return target;
    } catch {}
    await delay(200);
  }
  throw new Error('Edge debugging target did not become ready');
}

const target = await getTarget();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let callId = 0;
const pending = new Map();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const call = pending.get(message.id);
  pending.delete(message.id);
  message.error ? call.reject(new Error(message.error.message)) : call.resolve(message.result);
});

function cdp(method, params = {}) {
  const id = ++callId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}

async function waitUntil(expression, timeoutMs = 9000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return;
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${expression}`);
}

await cdp('Runtime.enable');
await cdp('Page.enable');
await waitUntil(`location.origin === '${APP_ORIGIN}' && document.readyState === 'complete'`);

async function resetTasks() {
  await evaluate(`localStorage.clear(); true`);
  await cdp('Page.reload', { ignoreCache: true });
  await waitUntil(`document.querySelectorAll('.task-row').length === 4`);
}

test('task titles cannot create executable attributes', async () => {
  await resetTasks();
  await evaluate(`(() => {
    const input = document.querySelector('#task-input');
    input.value = 'x" onclick="window.__injected=1';
    document.querySelector('#task-form').requestSubmit();
    return true;
  })()`);
  assert.equal(await evaluate(`document.querySelectorAll('.task-delete[onclick]').length`), 0);
  assert.equal(await evaluate(`window.__injected ?? 0`), 0);
});

test('task mutation controls are disabled throughout a spin', async () => {
  await resetTasks();
  await evaluate(`document.querySelector('#spin-button').click(); true`);
  assert.equal(await evaluate(`document.querySelector('#task-input').disabled`), true);
  assert.equal(await evaluate(`[...document.querySelectorAll('.task-check,.task-delete,#task-form button')].every((button) => button.disabled)`), true);
});

test('page and panels use a neutral black and graphite theme', async () => {
  await resetTasks();
  const colors = await evaluate(`(() => {
    const read = (selector) => getComputedStyle(document.querySelector(selector)).backgroundColor;
    return {
      body: read('body'),
      panel: read('.panel'),
      task: read('.task-row'),
      wheelRim: getComputedStyle(document.querySelector('.wheel > circle')).fill,
    };
  })()`);
  const channels = (color) => color.match(/\d+/g).slice(0, 3).map(Number);
  const [bodyR, bodyG, bodyB] = channels(colors.body);
  const [panelR, panelG, panelB] = channels(colors.panel);
  const [taskR, taskG, taskB] = channels(colors.task);
  const [rimR, rimG, rimB] = channels(colors.wheelRim);

  assert.deepEqual([bodyR, bodyG, bodyB], [0, 0, 0]);
  assert.equal(panelR, panelG);
  assert.equal(panelG, panelB);
  assert.ok(panelR > 0 && panelR <= 24);
  assert.equal(taskR, taskG);
  assert.equal(taskG, taskB);
  assert.ok(taskR > panelR);
  assert.equal(rimR, rimG);
  assert.equal(rimG, rimB);
});

test('wheel and task accents are vivid while the logo is red', async () => {
  await resetTasks();
  const accents = await evaluate(`(() => ({
    taskColors: [...document.querySelectorAll('.task-check')].map((node) => getComputedStyle(node).backgroundColor),
    logoColor: getComputedStyle(document.querySelector('.brand-icon')).color,
  }))()`);
  const channels = (color) => color.match(/\d+/g).slice(0, 3).map(Number);

  for (const color of accents.taskColors) {
    const rgb = channels(color);
    assert.ok(Math.max(...rgb) - Math.min(...rgb) >= 150);
  }
  const [red, green, blue] = channels(accents.logoColor);
  assert.ok(red >= 230 && green <= 80 && blue <= 80);
});

test('timer updates preserve keyboard focus', async () => {
  await resetTasks();
  await evaluate(`document.querySelector('#spin-button').click(); true`);
  await waitUntil(`!document.querySelector('#selection-modal').hidden`, 10000);
  assert.equal(await evaluate(`document.querySelector('#selection-modal').hidden`), false);
  assert.equal(await evaluate(`document.querySelector('#selection-panel').hidden`), true);
  assert.ok(await evaluate(`document.querySelectorAll('.confetti-piece').length`) >= 24);
  assert.match(await evaluate(`document.querySelector('.focus-reaction').textContent`), /ура|фу|погнали|выпало/i);
  await evaluate(`document.querySelector('[data-confirm-task]').click(); true`);
  assert.equal(await evaluate(`document.querySelector('#selection-modal').hidden`), true);
  assert.equal(await evaluate(`document.querySelector('#selection-panel').hidden`), false);
  await evaluate(`document.querySelector('[data-duration="15"]').click(); true`);
  await waitUntil(`Boolean(document.querySelector('[data-timer-action="pause"]'))`);
  await evaluate(`document.querySelector('[data-timer-action="pause"]').focus(); true`);
  await delay(500);
  assert.equal(await evaluate(`document.activeElement?.dataset?.timerAction`), 'pause');
});

test('storage write failure keeps the in-memory task and reports persistence status', async () => {
  await resetTasks();
  await evaluate(`(() => {
    Storage.prototype.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); };
    const input = document.querySelector('#task-input');
    input.value = 'Важная задача';
    document.querySelector('#task-form').requestSubmit();
    return true;
  })()`);
  assert.equal(await evaluate(`document.querySelectorAll('.task-row').length`), 5);
  assert.match(await evaluate(`document.querySelector('#status').textContent`), /не сохран/i);
});

test('blocked localStorage access falls back to sample tasks', async () => {
  await cdp('Page.addScriptToEvaluateOnNewDocument', {
    source: `Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('blocked', 'SecurityError'); } });`,
  });
  await cdp('Page.reload', { ignoreCache: true });
  await waitUntil(`document.readyState === 'complete'`);
  assert.equal(await evaluate(`document.querySelectorAll('.task-row').length`), 4);
});

test.after(() => socket.close());
