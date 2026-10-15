let audioContext;

export function createRatchetSchedule(durationMs, clickCount = 48) {
  const audibleDuration = Math.max(0, durationMs - 180);
  return Array.from({ length: clickCount }, (_, index) => {
    const progress = clickCount === 1 ? 0 : index / (clickCount - 1);
    return Math.round(audibleDuration * progress ** 1.65);
  });
}

export function playRatchet(durationMs) {
  const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContextClass) return;

  audioContext ??= new AudioContextClass();
  const scheduleClicks = () => {
    const start = audioContext.currentTime + 0.015;
    const clicks = createRatchetSchedule(durationMs);

    clicks.forEach((delayMs, index) => {
      const progress = index / Math.max(1, clicks.length - 1);
      const time = start + delayMs / 1000;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(980 - progress * 260, time);
      gain.gain.setValueAtTime(0.024, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.018);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(time);
      oscillator.stop(time + 0.02);
    });
  };

  if (audioContext.state === 'suspended') {
    audioContext.resume().then(scheduleClicks).catch(() => {});
  } else {
    scheduleClicks();
  }
}
