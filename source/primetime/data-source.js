(() => {
  const preferenceKey = 'primetime.dataMode';
  let mode = 'demo';
  let generation = 0;
  let active = false;
  let scope = null;
  const requests = new Set();
  try {
    if (window.sessionStorage?.getItem(preferenceKey) === 'live') mode = 'live';
  } catch { /* Mode selection works without browser storage. */ }

  function invalidate() {
    generation += 1;
    for (const controller of requests) controller.abort();
    requests.clear();
  }

  function announce() {
    const event = new Event('primetime-data-mode-changed');
    event.detail = Object.freeze({ mode, generation });
    document.dispatchEvent(event);
  }

  function setMode(next) {
    if (next !== 'demo' && next !== 'live') throw new Error('invalid_data_mode');
    if (next === mode) return;
    invalidate();
    mode = next;
    try { window.sessionStorage?.setItem(preferenceKey, mode); } catch { /* Optional. */ }
    announce();
  }

  function reset() {
    active = false;
    scope = null;
    invalidate();
    mode = 'demo';
    try { window.sessionStorage?.removeItem(preferenceKey); } catch { /* Optional. */ }
    announce();
  }

  window.primetimeDataMode = Object.freeze({
    getMode: () => mode,
    getGeneration: () => generation,
    isLive: () => mode === 'live',
    isActive: () => active,
    setMode,
    reset,
    // Observed server settings, not browser authority. Any changed office or
    // policy clears every panel and fences responses already in flight.
    observeScope(settings) {
      if (!settings || !Number.isInteger(settings.revision)) return false;
      const next = JSON.stringify([settings.officeId, settings.officeTimezone, settings.revision]);
      if (scope === next) return false;
      const changed = scope !== null;
      scope = next;
      if (changed) { invalidate(); announce(); }
      return changed;
    },
    trackRequest(controller) {
      requests.add(controller);
      return () => requests.delete(controller);
    }
  });

  document.addEventListener('primetime-ready', () => { active = true; });
  document.addEventListener('primetime-signed-out', event => {
    if (event.preserveDataMode === true) {
      active = false;
      invalidate();
      announce();
    } else reset();
  });
})();
