// AquaTrace background service worker (Manifest V3)
// Owns the single source of truth in chrome.storage.local.

const DEFAULT_STATE = {
  totalQueries: 0,
  totalTokens: 0,
  totalMl: 0,
  waterMode: 'comprehensive', // 'direct' (on-site cooling only) or 'comprehensive' (incl. power grid)
  mlPer1000Tokens: 146, // default: comprehensive lifecycle estimate, ~100-150ml/1000 tokens
  bySite: {}
};

const ALL_KEYS = Object.keys(DEFAULT_STATE);

async function restoreFromSync() {
  try {
    const syncData = await chrome.storage.sync.get(ALL_KEYS);
    const hasSync = Object.keys(syncData).length > 0;
    if (!hasSync) return;

    // Merge sync values into local storage so data survives reinstalls
    const toSet = {};
    for (const k of ALL_KEYS) {
      if (syncData[k] !== undefined) toSet[k] = syncData[k];
    }
    if (Object.keys(toSet).length) {
      await chrome.storage.local.set(toSet);
    }
  } catch (e) {
    // Ignore sync errors (quota, disabled sync, etc.)
  }
}

async function syncBackup(state) {
  try {
    // Only send small payloads; our state is small and should fit quota
    const toSync = {};
    for (const k of ALL_KEYS) {
      if (state[k] !== undefined) toSync[k] = state[k];
    }
    await chrome.storage.sync.set(toSync);
  } catch (e) {
    // Ignore sync errors (quota, disabled sync, etc.)
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  // Attempt to restore a sync-backed copy first so data survives reinstall
  await restoreFromSync();

  const existing = await chrome.storage.local.get(ALL_KEYS);
  const toSet = {};
  for (const key of ALL_KEYS) {
    if (existing[key] === undefined) toSet[key] = DEFAULT_STATE[key];
  }
  if (Object.keys(toSet).length) {
    await chrome.storage.local.set(toSet);
  }
  updateBadge();
});

chrome.runtime.onStartup.addListener(() => {
  // Sync restore on startup as well
  restoreFromSync().then(updateBadge);
});

async function updateBadge() {
  const { totalMl = 0 } = await chrome.storage.local.get('totalMl');
  const label = totalMl >= 1000 ? `${(totalMl / 1000).toFixed(1)}L` : `${Math.round(totalMl)}`;
  chrome.action.setBadgeText({ text: label });
  chrome.action.setBadgeBackgroundColor({ color: '#3B9EFF' });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'TRACK_PROMPT') {
    (async () => {
      const data = await chrome.storage.local.get(['totalQueries', 'totalTokens', 'totalMl', 'mlPer1000Tokens', 'bySite']);
      const mlPer1000Tokens =
        typeof data.mlPer1000Tokens === 'number' ? data.mlPer1000Tokens : DEFAULT_STATE.mlPer1000Tokens;

      const tokens = Math.max(0, Math.round(message.tokens || 0));
      const addedMl = (tokens / 1000) * mlPer1000Tokens;

      const totalQueries = (data.totalQueries || 0) + 1;
      const totalTokens = (data.totalTokens || 0) + tokens;
      const totalMl = (data.totalMl || 0) + addedMl;
      const bySite = data.bySite || {};
      const site = message.site || 'unknown';
      bySite[site] = (bySite[site] || 0) + 1;

      await chrome.storage.local.set({ totalQueries, totalTokens, totalMl, bySite });
      await updateBadge();
      // Also back up new state to sync so it can be restored after reinstall
      syncBackup({ totalQueries, totalTokens, totalMl, bySite, mlPer1000Tokens, waterMode: data.waterMode });
      sendResponse({ ok: true, totalQueries, totalTokens, totalMl });
    })();
    return true; // keep the message channel open for the async response
  }

  if (message?.type === 'RESET_STATS') {
    (async () => {
      await chrome.storage.local.set({ totalQueries: 0, totalTokens: 0, totalMl: 0, bySite: {} });
      await updateBadge();
      try {
        await chrome.storage.sync.set({ totalQueries: 0, totalTokens: 0, totalMl: 0, bySite: {} });
      } catch (e) {
        // ignore
      }
      sendResponse({ ok: true });
    })();
    return true;
  }
});
