# Task Wheel Prototype — Design Specification

## Purpose

Build a fast, presentation-ready web prototype that demonstrates a single idea: tasks become sectors on a fortune wheel, and spinning the wheel chooses what the user should do next. The experience should feel exciting enough for an Instagram Reels demo while still reading primarily as a productivity product rather than a gambling product.

## Audience and success criteria

The prototype is for a short social-media concept demo. A viewer should understand the product within a few seconds without explanation.

Success means the prototype:

- clearly connects the task list and wheel sectors;
- makes adding a task immediate;
- produces a visually satisfying random selection;
- asks for focus time only after a task has been selected;
- provides a usable countdown timer;
- remains polished and legible in a vertical Reels-style viewport;
- can later be committed to GitHub and deployed to Vercel without restructuring.

## Scope

The MVP is a client-only single-page application. It includes task creation, deletion, completion, wheel generation, animated random selection, post-selection duration choice, and a focus timer. Tasks persist locally in the browser.

The MVP does not include accounts, cloud sync, collaboration, analytics, sounds that require downloaded assets, or a backend.

## Primary flow

1. The initial screen contains several sample tasks so the concept is immediately visible.
2. The user adds a task using a single text field. No duration or metadata is requested.
3. The new task appears in the list and becomes a new wheel sector.
4. The user presses the primary spin control.
5. The wheel rotates through multiple turns and lands on one active task.
6. The selected task is emphasized in both the wheel and task list.
7. A focused result panel asks the user to choose 15, 25, 45, or 60 minutes, or enter a custom duration.
8. Starting the session replaces the duration controls with a countdown timer.
9. The user can pause, resume, reset, or mark the task complete.
10. Completed tasks remain visible but are excluded from future spins unless restored.

If no active tasks exist, the spin control is disabled and the interface prompts the user to add or restore a task. Task names are trimmed, blank tasks are rejected, and custom durations must be positive whole minutes.

## Visual direction

The interface uses a deep navy page background and slightly lighter navy panels. The wheel sectors use a restrained pastel palette: lavender, powder blue, mint, butter yellow, soft coral, dusty pink, and muted teal. The palette should feel pleasant and productive; saturated casino red, neon effects, coins, jackpots, and ornamental gambling imagery are excluded.

The composition keeps the large wheel on the left and the task list on the right, including in the intended vertical demo viewport. Typography is bold and highly legible. Rounded cards, restrained borders, soft shadows, and subtle gradients add depth without making the page glossy. Motion provides the playful energy: the pointer reacts as sectors pass, the selected task lifts visually, and the timer transition feels decisive.

The supplied screenshots are visual references only. They inform the dark navy base, simple wheel geometry, compact task rows, and clear pointer, but their copy and branding are not reproduced.

## Responsive behavior

The hero experience is optimized for a 9:16 capture while remaining usable on desktop. Wide screens use a centered two-column application frame. Vertical screens preserve the left-wheel/right-list relationship with balanced column widths and reduced labels; extremely narrow screens may stack the panels to retain usability.

## Architecture and state

The prototype uses buildless HTML, CSS, and JavaScript so it can be opened locally and deployed as a static Vercel project. The wheel is rendered with SVG, allowing dynamic sectors, readable labels, and smooth rotation without external graphics.

Application state contains:

- tasks: identifier, title, color, and completion status;
- current wheel rotation;
- selected task identifier;
- timer duration, remaining seconds, and running state.

Task state is serialized to `localStorage`. The active timer runs in memory; refreshing the page resets the timer but preserves tasks. This keeps the demo simple and avoids misleading background-timer behavior.

## Components

- App shell: heading, short explanatory line, and two-column layout.
- Wheel: SVG sectors, labels, center hub, pointer, and spin action.
- Task composer: one input and add button.
- Task list: task rows with color marker, completion control, and delete action.
- Selection panel: selected task plus duration presets and custom input.
- Focus timer: countdown, pause/resume, reset, and complete controls.
- Toast/status region: accessible feedback for invalid input and completed actions.

## Accessibility and interaction

All actions are keyboard reachable and have visible focus states. Color is not the only indicator of selection or completion. Animations respect `prefers-reduced-motion`; in reduced-motion mode, the selection still changes clearly without extended rotation. Buttons expose meaningful labels, and status changes use a polite live region.

## Verification

Manual and scripted checks will cover:

- initial sample state and local persistence;
- adding, rejecting blank input, deleting, completing, and restoring tasks;
- correct sector count after task changes;
- disabled spin state with no active tasks;
- random selection restricted to active tasks;
- duration presets and custom-duration validation;
- timer start, pause, resume, reset, and completion;
- reduced-motion behavior;
- layout at desktop and representative vertical/mobile widths.

## Deployment readiness

The project will keep all deployable static files in a clear root or output directory and avoid machine-specific paths. A later delivery step can create a GitHub repository and connect it to Vercel. No deployment or remote repository creation is part of this initial prototype unless explicitly requested at that stage.
