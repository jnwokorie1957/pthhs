(() => {
  function timestampInstant(value) {
    const match = typeof value === 'string' && value.match(/^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/);
    if (!match) return null;
    const day = Date.parse(match[1] + 'T00:00:00Z');
    if (!Number.isFinite(day) || new Date(day).toISOString().slice(0, 10) !== match[1]) return null;
    const instant = Date.parse(value); return Number.isFinite(instant) ? instant : null;
  }
  function fetchAgeText(fetched, now = Date.now()) {
    let elapsed = 'unavailable (missing or invalid fetch timestamp)';
    if (fetched !== null) {
      if (!Number.isFinite(now)) elapsed = 'unavailable (invalid device clock)';
      else if (now < fetched) elapsed = 'unavailable (fetch timestamp is ahead of this device clock)';
      else {
        const minutes = Math.floor((now - fetched) / 60_000), hours = Math.floor(minutes / 60), days = Math.floor(hours / 24);
        elapsed = minutes === 0 ? 'less than 1 min' : days ? `${days} d ${hours % 24} h ${minutes % 60} min` : hours ? `${hours} h ${minutes % 60} min` : `${minutes} min`;
      }
    }
    return `Approximate fetch age: ${elapsed}. Uses this device clock; age updates locally each minute. Source refresh requires an explicit read.`;
  }
  window.primetimeSourceTime = Object.freeze({ timestampInstant, fetchAgeText });
  const preferenceKey = 'primetime.dataMode';
  let mode = 'live';
  let generation = 0;
  let active = false;
  let scope = null;
  const requests = new Set();
  try {
    if (window.sessionStorage?.getItem(preferenceKey) === 'demo') mode = 'demo';
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
    mode = 'live';
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
