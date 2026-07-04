// AquaTrace content script
//
// Instead of just counting "a prompt was sent", this reads the actual text
// the user typed and estimates how many tokens it contains — entirely on the
// device, with no API calls and no external tokenizer library. Longer
// prompts count for more water than short ones, the same way a real usage
// bill would work.
//
// Submission is still detected the universal way: pressing Enter inside an
// editable input, or clicking a control that looks like a "send" button.

(() => {
  const DEBOUNCE_MS = 1500; // guards against a single submit firing both a
                             // keydown AND a click event and being double counted
  let lastTrackedAt = 0;
  let lastEditableRoot = null; // the actual composer box the user was last typing in

  // Finds the real editable element to read text from — climbing up to the
  // contenteditable container itself if the given element is just a nested
  // span/div inside it (common with rich-text editors like ProseMirror).
  function getEditableRoot(el) {
    if (!el) return null;
    if (el.tagName && el.tagName.toLowerCase() === 'textarea') return el;
    if (el.closest) {
      const explicit = el.closest('[contenteditable="true"]');
      if (explicit) return explicit;
    }
    if (el.isContentEditable) return el;
    return null;
  }

  function getEditableValue(el) {
    if (!el) return '';
    if (el.tagName && el.tagName.toLowerCase() === 'textarea') return el.value || '';
    return el.textContent || '';
  }

  function looksLikeSendControl(el) {
    if (!el) return false;
    const btn = el.closest ? el.closest('button, [role="button"]') : null;
    if (!btn) return false;
    const testId = (btn.getAttribute('data-testid') || '').toLowerCase();
    const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
    const text = (btn.textContent || '').trim().toLowerCase();

    if (btn.disabled) return false;

    return (
      testId.includes('send') ||
      ariaLabel.includes('send message') ||
      ariaLabel.includes('send prompt') ||
      ariaLabel === 'send' ||
      ariaLabel.includes('submit') ||
      text === 'send'
    );
  }

  // Local, offline token estimate. No API, no downloaded vocabulary — just
  // the same rule of thumb model providers themselves use for quick
  // estimates: roughly 4 characters per token, blended with a words-based
  // estimate so both very dense and very sparse text stay reasonable.
  function estimateTokens(text) {
    const trimmed = (text || '').trim();
    if (!trimmed) return 0;
    const charEstimate = trimmed.length / 4;
    const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
    const wordEstimate = wordCount * 1.3;
    return Math.max(1, Math.round((charEstimate + wordEstimate) / 2));
  }

  function trackPrompt(text, source) {
    const now = Date.now();
    if (now - lastTrackedAt < DEBOUNCE_MS) return;
    lastTrackedAt = now;

    const tokens = estimateTokens(text);
    if (tokens <= 0) return;

    try {
      chrome.runtime.sendMessage(
        { type: 'TRACK_PROMPT', tokens, site: location.hostname, source },
        () => {
          // Swallow "Receiving end does not exist" noise if the service
          // worker was momentarily asleep; storage write already happened
          // once it wakes because the message is delivered on wake.
          void chrome.runtime.lastError;
        }
      );
    } catch (e) {
      // Extension context invalidated (e.g. reloaded) — ignore silently.
    }
  }

  // Keep track of whichever box the user is actually typing in, so a click
  // on "Send" reads text from the right place instead of guessing at the
  // first matching element anywhere on the page.
  document.addEventListener(
    'input',
    (e) => {
      const root = getEditableRoot(e.target);
      if (root) lastEditableRoot = root;
    },
    true
  );

  document.addEventListener(
    'focusin',
    (e) => {
      const root = getEditableRoot(e.target);
      if (root) lastEditableRoot = root;
    },
    true
  );

  // 1) Enter-to-send detection
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
      const root = getEditableRoot(e.target);
      if (!root) return;
      const value = getEditableValue(root);
      if (!value || !value.trim()) return;
      trackPrompt(value, 'enter');
    },
    true
  );

  // 2) Click-to-send detection — uses the last box the user actually typed
  // in, since the click target is the button, not the input.
  document.addEventListener(
    'click',
    (e) => {
      if (!looksLikeSendControl(e.target)) return;
      const value = getEditableValue(lastEditableRoot);
      if (!value || !value.trim()) return;
      trackPrompt(value, 'click');
    },
    true
  );
})();
