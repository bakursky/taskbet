export function parseDuration(value) {
  if (value === '' || value === null || value === undefined) return null;
  const minutes = Number(value);
  return Number.isInteger(minutes) && minutes > 0 ? minutes : null;
}

export function createTimer(durationMinutes) {
  const minutes = parseDuration(durationMinutes);
  if (minutes === null) throw new RangeError('Duration must be a positive whole number');
  const durationSeconds = minutes * 60;
  return { durationSeconds, remainingSeconds: durationSeconds, running: false, deadlineMs: null };
}

export function getRemainingSeconds(state, nowMs = Date.now()) {
  if (!state.running || state.deadlineMs === null) return Math.max(0, state.remainingSeconds);
  return Math.max(0, Math.ceil((state.deadlineMs - nowMs) / 1000));
}

export function startTimer(state, nowMs = Date.now()) {
  if (state.running || state.remainingSeconds <= 0) return { ...state };
  return { ...state, running: true, deadlineMs: nowMs + state.remainingSeconds * 1000 };
}

export function pauseTimer(state, nowMs = Date.now()) {
  return {
    ...state,
    remainingSeconds: getRemainingSeconds(state, nowMs),
    running: false,
    deadlineMs: null,
  };
}

export function resetTimer(state) {
  return {
    ...state,
    remainingSeconds: state.durationSeconds,
    running: false,
    deadlineMs: null,
  };
}

export function formatTime(seconds) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  const parts = [minutes, secs].map((part) => String(part).padStart(2, '0'));
  if (hours) parts.unshift(String(hours).padStart(2, '0'));
  return parts.join(':');
}
