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

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get(Object.keys(DEFAULT_STATE));
  const toSet = {};
  for (const key of Object.keys(DEFAULT_STATE)) {
    if (existing[key] === undefined) toSet[key] = DEFAULT_STATE[key];
  }
  if (Object.keys(toSet).length) {
    await chrome.storage.local.set(toSet);
  }
  updateBadge();
});

chrome.runtime.onStartup.addListener(() => {
  updateBadge();
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
      sendResponse({ ok: true, totalQueries, totalTokens, totalMl });
    })();
    return true; // keep the message channel open for the async response
  }

  if (message?.type === 'RESET_STATS') {
    (async () => {
      await chrome.storage.local.set({ totalQueries: 0, totalTokens: 0, totalMl: 0, bySite: {} });
      await updateBadge();
      sendResponse({ ok: true });
    })();
    return true;
  }
});
