// AquaTrace popup logic

const VESSEL_IDS = ['glass', 'bottle', 'jug', 'gallon'];

const SITE_NAMES = {
  'chatgpt.com': 'ChatGPT',
  'chat.openai.com': 'ChatGPT',
  'gemini.google.com': 'Gemini',
  'claude.ai': 'Claude'
};

// Two published system boundaries for "water per AI query," per vendor
// disclosures and lifecycle studies (e.g. Mistral's 2025 environmental
// report, the UC Riverside estimate). Neither number is "wrong" — they're
// answering different questions.
const MODE_PRESETS = {
  direct: {
    defaultMl: 2,
    caption: 'On-site cooling only, as reported directly by data center operators. Roughly 0.5–3 ml per 1,000 tokens.'
  },
  comprehensive: {
    defaultMl: 146,
    caption: 'Includes the water used to generate the electricity that powers the servers. Roughly 100–150 ml per 1,000 tokens.'
  }
};

function clamp(v) {
  return Math.max(0, Math.min(100, v));
}

// Determines which vessel to show and how full it should be, per the
// required thresholds:
//   < 250ml            -> drinking glass, 0-100%
//   250ml - 999ml       -> water bottle, scaled within that range
//   1000ml - 3784ml      -> 1L carafe/jug, scaled within that range
//   3785ml (1 gallon)+    -> gallon jug, loops per additional gallon
function getVesselConfig(totalMl) {
  if (totalMl < 250) {
    return {
      type: 'glass',
      pct: clamp((totalMl / 250) * 100),
      label: 'Drinking Glass'
    };
  }

  if (totalMl < 1000) {
    return {
      type: 'bottle',
      pct: clamp(((totalMl - 250) / (1000 - 250)) * 100),
      label: 'Water Bottle'
    };
  }

  if (totalMl < 3785) {
    return {
      type: 'jug',
      pct: clamp(((totalMl - 1000) / (3785 - 1000)) * 100),
      label: '1-Liter Carafe'
    };
  }

  const GALLON_ML = 3785;
  const overGallon = totalMl - GALLON_ML;
  const gallonsFull = Math.floor(overGallon / GALLON_ML) + 1;
  const remainder = overGallon % GALLON_ML;
  return {
    type: 'gallon',
    pct: clamp((remainder / GALLON_ML) * 100),
    label: `Gallon Jug · ${gallonsFull} gallon${gallonsFull > 1 ? 's' : ''} total`
  };
}

function renderSiteBreakdown(bySite) {
  const container = document.getElementById('siteBreakdown');
  const entries = Object.entries(bySite || {}).filter(([, count]) => count > 0);

  if (!entries.length) {
    container.innerHTML = '<p class="empty-state">No prompts tracked yet. Start chatting!</p>';
    return;
  }

  entries.sort((a, b) => b[1] - a[1]);

  container.innerHTML = entries
    .map(([site, count]) => {
      const name = SITE_NAMES[site] || site;
      return `<div class="site-row"><span class="site-name">${name}</span><span class="site-count">${count}</span></div>`;
    })
    .join('');
}

function render(data) {
  const totalMl = data.totalMl || 0;
  const totalQueries = data.totalQueries || 0;
  const totalTokens = data.totalTokens || 0;

  document.getElementById('totalMl').textContent = Math.round(totalMl).toLocaleString();
  document.getElementById('totalQueries').textContent = totalQueries.toLocaleString();
  document.getElementById('totalTokens').textContent = Math.round(totalTokens).toLocaleString();

  const config = getVesselConfig(totalMl);
  document.getElementById('containerLabel').textContent = config.label;

  VESSEL_IDS.forEach((id) => {
    const el = document.getElementById('vessel-' + id);
    el.style.display = id === config.type ? 'flex' : 'none';
  });

  const waterEl = document.getElementById('water-' + config.type);
  if (waterEl) {
    // Force a reflow-free async set so the CSS transition always animates,
    // even when switching vessel type and fill % in the same render pass.
    requestAnimationFrame(() => {
      waterEl.style.height = config.pct + '%';
    });
  }

  renderSiteBreakdown(data.bySite);
  renderModeToggle(data.waterMode);
}

function renderModeToggle(waterMode) {
  const mode = waterMode === 'direct' ? 'direct' : 'comprehensive';
  document.getElementById('modeDirectBtn').classList.toggle('active', mode === 'direct');
  document.getElementById('modeComprehensiveBtn').classList.toggle('active', mode === 'comprehensive');
  document.getElementById('modeCaption').textContent = MODE_PRESETS[mode].caption;
}

async function refresh() {
  const data = await chrome.storage.local.get([
    'totalQueries',
    'totalTokens',
    'totalMl',
    'mlPer1000Tokens',
    'waterMode',
    'bySite'
  ]);
  render(data);
  const mlInput = document.getElementById('mlPer1000Tokens');
  if (document.activeElement !== mlInput) {
    mlInput.value = data.mlPer1000Tokens ?? 146;
  }
}

function init() {
  refresh();

  document.getElementById('mlPer1000Tokens').addEventListener('change', async (e) => {
    let val = parseFloat(e.target.value);
    if (isNaN(val) || val <= 0) val = 146;
    await chrome.storage.local.set({ mlPer1000Tokens: val });
  });

  document.getElementById('modeToggle').addEventListener('click', async (e) => {
    const btn = e.target.closest('.mode-btn');
    if (!btn) return;
    const mode = btn.dataset.mode;
    const preset = MODE_PRESETS[mode];
    if (!preset) return;
    await chrome.storage.local.set({ waterMode: mode, mlPer1000Tokens: preset.defaultMl });
  });

  document.getElementById('resetBtn').addEventListener('click', async () => {
    const confirmed = window.confirm('Reset all AquaTrace stats? This cannot be undone.');
    if (!confirmed) return;
    await chrome.runtime.sendMessage({ type: 'RESET_STATS' });
    refresh();
  });

  // Export / Import handlers
  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const importFile = document.getElementById('importFile');

  exportBtn.addEventListener('click', async () => {
    const data = await chrome.storage.local.get();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aquatrace-backup.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  importBtn.addEventListener('click', () => importFile.click());

  importFile.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      // Basic validation: must include numeric totals
      if (typeof parsed.totalMl !== 'number' || typeof parsed.totalQueries !== 'number') {
        alert('Invalid backup file.');
        return;
      }
      const confirmed = window.confirm('Importing will overwrite current stats. Continue?');
      if (!confirmed) return;
      await chrome.storage.local.set(parsed);
      // Also attempt to sync the imported state so reinstalls preserve it
      try {
        await chrome.storage.sync.set(parsed);
      } catch (e) {
        // ignore sync errors
      }
      refresh();
      alert('Import complete.');
    } catch (err) {
      alert('Failed to import file: ' + err.message);
    } finally {
      importFile.value = '';
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    refresh();
  });
}

document.addEventListener('DOMContentLoaded', init);
