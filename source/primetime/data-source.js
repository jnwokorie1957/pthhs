(() => {
  function timestampInstant(value) {
    const match = typeof value === 'string' && value.match(/^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/);
    if (!match) return null;
    const day = Date.parse(match[1] + 'T00:00:00Z');
    if (!Number.isFinite(day) || new Date(day).toISOString().slice(0, 10) !== match[1]) return null;
    const instant = Date.parse(value); return Number.isFinite(instant) ? instant : null;
  }
  function fetchAgeText(fetched, now = Date.now(), automatic = true) {
    let elapsed = 'unavailable (missing or invalid fetch timestamp)';
    if (fetched !== null) {
      if (!Number.isFinite(now)) elapsed = 'unavailable (invalid device clock)';
      else if (now < fetched) elapsed = 'unavailable (fetch timestamp is ahead of this device clock)';
      else {
        const minutes = Math.floor((now - fetched) / 60_000), hours = Math.floor(minutes / 60), days = Math.floor(hours / 24);
        elapsed = minutes === 0 ? 'less than 1 min' : days ? `${days} d ${hours % 24} h ${minutes % 60} min` : hours ? `${hours} h ${minutes % 60} min` : `${minutes} min`;
      }
    }
    return `Approximate fetch age: ${elapsed}. Uses this device clock; ${automatic ? 'age updates locally each minute' : 'age updates paused — value held from the last display calculation'}. Source refresh requires an explicit read.`;
  }
  let automaticAgeUpdates = true;
  const ageListeners = new Set();
  function setAutomaticAgeUpdates(enabled) {
    if (enabled === automaticAgeUpdates) return;
    automaticAgeUpdates = enabled;
    for (const listener of [...ageListeners]) listener();
    renderAgeControl();
  }
  // Each display owns its timer and cleanup; the page-session choice is shared.
  function watchFetchAge(fetched, isCurrent, render, clear) {
    let active = true, timer = null, epoch = 0, calculatedAt = Date.now();
    const cancelTimer = () => {
      epoch++;
      if (timer !== null) clearInterval(timer);
      timer = null;
    };
    const stop = () => {
      if (!active) return;
      active = false;
      cancelTimer();
      ageListeners.delete(changed);
      clear();
    };
    const update = (recalculate = true) => {
      if (!active) return;
      if (!isCurrent()) { stop(); return; }
      if (recalculate) calculatedAt = Date.now();
      render(fetchAgeText(fetched, calculatedAt, automaticAgeUpdates));
    };
    const changed = () => {
      if (!active) return;
      cancelTimer();
      update(automaticAgeUpdates);
      if (active && automaticAgeUpdates && fetched !== null) {
        const capturedEpoch = epoch;
        timer = setInterval(() => {
          if (active && automaticAgeUpdates && epoch === capturedEpoch) update();
        }, 60_000);
      }
    };
    ageListeners.add(changed);
    changed();
    return stop;
  }
  window.primetimeSourceTime = Object.freeze({ timestampInstant, fetchAgeText, watchFetchAge });
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

  function renderAgeControl() {
    const control = document.getElementById('automaticAgeUpdates');
    const section = document.getElementById('fetchAgeControl');
    const status = document.getElementById('fetchAgeUpdateStatus');
    if (control) { control.checked = automaticAgeUpdates; control.disabled = !active || mode !== 'live'; }
    if (section) section.hidden = !active || mode !== 'live';
    if (status) status.textContent = automaticAgeUpdates
      ? 'On for this page session. Displayed ages update locally each minute; source data is read only on request.'
      : 'Paused for this page session. Existing ages stay at their last calculation; new reads show their initial age. Resume to recalculate from the original fetch receipts. Source data is read only on request.';
  }
  document.getElementById('automaticAgeUpdates')?.addEventListener('change', event => {
    if (!active || mode !== 'live') { renderAgeControl(); return; }
    setAutomaticAgeUpdates(event.target.checked === true);
  });
  document.addEventListener('primetime-data-mode-changed', renderAgeControl);
  document.addEventListener('primetime-ready', () => { active = true; renderAgeControl(); });
  document.addEventListener('primetime-signed-out', event => {
    if (event.preserveDataMode === true) {
      active = false;
      invalidate();
      announce();
    } else reset();
    setAutomaticAgeUpdates(true);
    renderAgeControl();
  });
  renderAgeControl();
})();
