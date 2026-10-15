# Task Wheel Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished static productivity prototype where tasks become wheel sectors, a spin chooses the next task, and the user then starts a configurable focus timer.

**Architecture:** A buildless single-page app uses focused ES modules for task state, wheel geometry/selection, timer state, and DOM orchestration. SVG renders the wheel, `localStorage` persists tasks, and Node's built-in test runner verifies pure state functions without adding dependencies.

**Tech Stack:** HTML5, CSS, vanilla JavaScript ES modules, SVG, Node.js `node:test`, localStorage

**Spec:** `docs/superpowers/specs/2026-10-15-task-wheel-design.md`

## Global Constraints

- Keep the project client-only and deployable as a static Vercel site.
- Use a deep navy interface with lighter navy panels and restrained pastel wheel sectors.
- Ask for duration only after the wheel selects a task.
- Preserve a left-wheel/right-task-list composition in the vertical demo viewport; stack only at extremely narrow widths.
- Persist tasks only; refreshing resets any active timer.
- Exclude completed tasks from spins while keeping them restorable.
- Respect `prefers-reduced-motion` and provide keyboard-visible focus states.

## Review Focus

- Corrupt or unexpected localStorage data must fall back to sample tasks without crashing; covered in Task 1 tests.
- Whitespace-only and excessively long task titles must not create broken rows or sectors; covered in Task 1 tests.
- One active task and rapid repeated spin attempts must still select predictably and prevent concurrent spins; covered in Task 2 tests and UI state.
- Zero, negative, decimal, or nonnumeric custom durations must be rejected; covered in Task 3 tests.
- Timer ticks delayed by an inactive tab must derive remaining time from a deadline rather than accumulate interval drift; covered in Task 3 tests.

---

### Task 1: Task state and application shell

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `src/styles.css`
- Create: `src/task-store.js`
- Create: `src/app.js`
- Create: `tests/task-store.test.mjs`

**Interfaces:**
- Produces: `normalizeTitle(value: unknown): string`, `createTask(title: string, color: string, id?: string): Task`, `getActiveTasks(tasks: Task[]): Task[]`, `toggleTask(tasks: Task[], id: string): Task[]`, `removeTask(tasks: Task[], id: string): Task[]`, `loadTasks(storage: StorageLike): Task[]`, and `saveTasks(storage: StorageLike, tasks: Task[]): void`.
- Produces: DOM anchors `#wheel`, `#spin-button`, `#task-form`, `#task-list`, `#selection-panel`, and `#status` for later tasks.

- [ ] **Step 1: Write failing task-store tests**

Test trimmed task creation, 80-character title cap, blank rejection, active-task filtering, immutable toggle/removal, persistence round-trip, and corrupt-storage fallback to the exact sample task set.

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test tests/task-store.test.mjs`
Expected: FAIL because `src/task-store.js` does not exist.

- [ ] **Step 3: Implement the task-store interfaces**

Use plain serializable objects `{ id, title, color, completed }`; expose a fixed pastel palette and four sample tasks.

- [ ] **Step 4: Build the semantic app shell and base styling**

Create the navy two-column layout, header, wheel panel, task composer/list, selection region, status live region, responsive vertical rules, and visible focus/reduced-motion styles. Wire add, toggle, delete, persistence, and render lifecycle in `src/app.js`.

- [ ] **Step 5: Run task tests and a module syntax check**

Run: `node --test tests/task-store.test.mjs`
Expected: PASS.

Run: `node --check src/app.js`
Expected: exit 0.

- [ ] **Step 6: Commit**

Run: `git add package.json index.html src tests/task-store.test.mjs && git commit -m "feat: add task wheel application shell"`

### Task 2: Dynamic wheel and random selection

**Files:**
- Create: `src/wheel.js`
- Create: `tests/wheel.test.mjs`
- Modify: `src/app.js`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `getActiveTasks(tasks)` and DOM anchors from Task 1.
- Produces: `describeSector(index: number, count: number, radius?: number): string`, `getWinningIndex(finalDegrees: number, count: number): number`, `chooseSpin(currentDegrees: number, count: number, random?: () => number): { finalDegrees: number, winningIndex: number }`, and `renderWheel(svg: SVGElement, tasks: Task[], rotationDegrees: number): void`.

- [ ] **Step 1: Write failing wheel tests**

Assert valid SVG paths for 1, 2, and 7 sectors; winning-index bounds across representative rotations; deterministic selection with injected random values; and a defined result for exactly one active task.

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test tests/wheel.test.mjs`
Expected: FAIL because `src/wheel.js` does not exist.

- [ ] **Step 3: Implement geometry, spin selection, and SVG rendering**

Place the fixed pointer at 12 o'clock, add 5–8 full rotations, compute the chosen index before animation, and shorten labels safely for narrow sectors.

- [ ] **Step 4: Wire wheel interaction into the app**

Disable spinning with no active tasks or while spinning, animate rotation, update the status region, highlight the winning list row, and reveal the selection panel after `transitionend` with a timeout fallback. In reduced-motion mode, select immediately.

- [ ] **Step 5: Run wheel and regression tests**

Run: `node --test tests/*.test.mjs`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

Run: `git add src/wheel.js src/app.js src/styles.css tests/wheel.test.mjs && git commit -m "feat: add animated task wheel"`

### Task 3: Post-selection focus timer and final polish

**Files:**
- Create: `src/timer.js`
- Create: `tests/timer.test.mjs`
- Modify: `src/app.js`
- Modify: `src/styles.css`
- Modify: `index.html`

**Interfaces:**
- Consumes: selected task identifier and task toggle action from earlier tasks.
- Produces: `parseDuration(value: unknown): number | null`, `createTimer(durationMinutes: number, nowMs?: number): TimerState`, `startTimer(state: TimerState, nowMs?: number): TimerState`, `pauseTimer(state: TimerState, nowMs?: number): TimerState`, `getRemainingSeconds(state: TimerState, nowMs?: number): number`, `resetTimer(state: TimerState): TimerState`, and `formatTime(seconds: number): string`.

- [ ] **Step 1: Write failing timer tests**

Assert acceptance of positive whole minutes; rejection of zero, negative, decimal, empty, and nonnumeric values; exact preset durations; deadline-based elapsed time; pause/resume preservation; reset; and `MM:SS`/`HH:MM:SS` formatting.

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test tests/timer.test.mjs`
Expected: FAIL because `src/timer.js` does not exist.

- [ ] **Step 3: Implement pure timer state transitions**

Represent duration and remaining time in seconds, store a deadline only while running, and calculate remaining time from `nowMs` to avoid interval drift.

- [ ] **Step 4: Build and wire the selection/timer views**

Show 15, 25, 45, and 60 minute presets plus a custom whole-minute input only after selection. Add start, pause/resume, reset, and complete controls; completion toggles the selected task and returns to the wheel state.

- [ ] **Step 5: Polish the Reels presentation**

Add pointer tick feedback, selected-card emphasis, timer transition, empty state, concise Russian interface copy, overflow handling, and final desktop/9:16/extremely-narrow layout adjustments.

- [ ] **Step 6: Run full verification**

Run: `node --test tests/*.test.mjs`
Expected: all tests PASS.

Run: `node --check src/app.js && node --check src/task-store.js && node --check src/wheel.js && node --check src/timer.js`
Expected: exit 0.

- [ ] **Step 7: Commit**

Run: `git add index.html src tests/timer.test.mjs && git commit -m "feat: add focus timer and polish prototype"`

### Task 4: Browser verification and deployment handoff

**Files:**
- Create: `README.md`
- Create: `vercel.json`
- Modify: files above only for defects observed during verification.

**Interfaces:**
- Consumes: complete static application.
- Produces: documented local preview and Vercel-ready static configuration.

- [ ] **Step 1: Run the complete automated suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 2: Preview and verify browser flows**

Serve the project locally and check add/delete/complete/restore, spin/result, every duration path, timer controls, refresh persistence, keyboard focus, reduced motion, desktop layout, 1080×1920-style viewport, and 360px viewport.

- [ ] **Step 3: Fix only observed defects and rerun verification**

Run: `npm test`
Expected: all tests PASS after any fixes.

- [ ] **Step 4: Document handoff**

Document local preview, tests, project structure, and the later GitHub-to-Vercel deployment steps without creating remotes or deploying yet.

- [ ] **Step 5: Commit**

Run: `git add README.md vercel.json index.html src tests package.json && git commit -m "docs: prepare prototype for Vercel"`
