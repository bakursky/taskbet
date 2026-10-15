export const BOOST_STORAGE_KEY = 'taskbet.boosts';

export function loadBoosts(storage) {
  try {
    const value = Number.parseInt(storage?.getItem(BOOST_STORAGE_KEY) ?? '0', 10);
    return Number.isInteger(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

export function saveBoosts(storage, boosts) {
  try {
    if (!storage) return false;
    storage.setItem(BOOST_STORAGE_KEY, String(Math.max(0, Math.floor(boosts))));
    return true;
  } catch {
    return false;
  }
}
