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

test('Taskbet branding and empty timer panel are visible on load', async () => {
  await resetTasks();
  assert.equal(await evaluate(`document.querySelector('.brand span').textContent`), 'Ставки на дело');
  assert.match(await evaluate(`document.title`), /Taskbet/);
  assert.equal(await evaluate(`document.querySelector('#selection-panel').hidden`), false);
  assert.match(await evaluate(`document.querySelector('#selection-panel').textContent`), /Ставок нет/);
});

test('self-promo links and project images are available to visitors', async () => {
  await resetTasks();
  assert.equal(
    await evaluate(`document.querySelector('[data-instagram-link]')?.href`),
    'https://www.instagram.com/bratan.dev/',
  );
  assert.equal(
    await evaluate(`document.querySelector('[data-instagram-link]')?.parentElement?.classList.contains('brand-group')`),
    true,
  );
  assert.deepEqual(
    await evaluate(`(() => {
      const style = getComputedStyle(document.querySelector('[data-instagram-link]'));
      return { background: style.backgroundColor, borderStyle: style.borderStyle, color: style.color };
    })()`),
    { background: 'rgba(0, 0, 0, 0)', borderStyle: 'dashed', color: 'rgb(255, 255, 255)' },
  );
  assert.deepEqual(
    await evaluate(`[...document.querySelectorAll('[data-project-link]')].map((link) => link.href)`),
    ['https://t.me/llm_arena_bot', 'https://100words.app/'],
  );
  assert.equal(
    await evaluate(`[...document.querySelectorAll('.project-card img')].every((image) => image.complete && image.naturalWidth > 0)`),
    true,
  );
});

test('promo additions do not cause horizontal overflow on mobile', async () => {
  await cdp('Emulation.setDeviceMetricsOverride', { width: 430, height: 900, deviceScaleFactor: 1, mobile: true });
  await resetTasks();
  const layout = await evaluate(`(() => ({
    innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    offenders: [...document.querySelectorAll('body *')]
      .filter((element) => element.getBoundingClientRect().right > innerWidth + 1)
      .slice(0, 8)
      .map((element) => ({ className: element.className?.baseVal ?? element.className, right: Math.round(element.getBoundingClientRect().right) }))
  }))()`);
  assert.equal(layout.scrollWidth, layout.innerWidth, JSON.stringify(layout));
  await cdp('Emulation.clearDeviceMetricsOverride');
});

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
  assert.equal(await evaluate(`[...document.querySelectorAll('.task-check,.task-edit,.task-delete,#task-form button')].every((button) => button.disabled)`), true);
});

test('task names can be edited inline and update the wheel', async () => {
  await resetTasks();
  await evaluate(`document.querySelector('.task-edit').click(); true`);
  assert.equal(await evaluate(`document.activeElement?.classList.contains('task-title-input')`), true);
  await evaluate(`(() => {
    const input = document.querySelector('.task-title-input');
    input.value = '  Новый   текст  ';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    return true;
  })()`);
  assert.equal(await evaluate(`document.querySelector('.task-title').textContent`), 'Новый текст');
  assert.match(await evaluate(`document.querySelector('#wheel').textContent`), /Новый текст/);
});

test('repeat presses boost the active spin while keeping a ten second cap', async () => {
  await resetTasks();
  assert.equal(await evaluate(`Boolean(document.querySelector('[data-spin-boosts]'))`), false);
  await evaluate(`document.querySelector('.task-check').click(); true`);
  assert.match(await evaluate(`document.querySelector('#boost-count').textContent`), /1/);
  await evaluate(`document.querySelector('#spin-button').click(); true`);
  await delay(80);
  const firstTarget = await evaluate(`document.querySelector('#wheel').style.transform`);
  assert.equal(await evaluate(`document.querySelector('#spin-button').disabled`), false);
  assert.match(await evaluate(`document.querySelector('#spin-button span').textContent`), /Подкрутить/);
  assert.equal(await evaluate(`document.querySelector('[data-spin-boosts]').textContent.trim()`), '1');
  await evaluate(`document.querySelector('#spin-button').click(); true`);
  await delay(80);
  const secondTarget = await evaluate(`document.querySelector('#wheel').style.transform`);
  const duration = await evaluate(`parseFloat(document.querySelector('#wheel').style.getPropertyValue('--spin-duration'))`);
  assert.notEqual(secondTarget, firstTarget);
  assert.ok(duration > 6800 && duration <= 10000);
  assert.match(await evaluate(`document.querySelector('#boost-count').textContent`), /0/);
  assert.equal(await evaluate(`document.querySelector('[data-spin-boosts]').textContent.trim()`), '0');
});

test('timer updates preserve keyboard focus', async () => {
  await resetTasks();
  await evaluate(`document.querySelector('#spin-button').click(); true`);
  await waitUntil(`!document.querySelector('#selection-modal').hidden`, 10000);
  assert.equal(await evaluate(`document.querySelector('#selection-modal').hidden`), false);
  assert.equal(await evaluate(`document.querySelector('#selection-panel').hidden`), false);
  assert.match(await evaluate(`document.querySelector('#selection-panel').textContent`), /Ставок нет/);
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
