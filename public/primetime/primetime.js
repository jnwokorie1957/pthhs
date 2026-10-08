(() => {
  const titles = {
    workbench: 'Operational tools',
    overview: 'Operations overview', evv: 'EVV exceptions', visits: 'Visit preview',
    messages: 'Messages & alerts', staffing: 'Staffing', billing: 'Billing & AR',
    hha: 'HHA integration', audit: 'Audit log', settings: 'Settings'
  };

  const navItems = [...document.querySelectorAll('[data-view]')];
  const panels = [...document.querySelectorAll('[data-view-panel]')];
  const pageTitle = document.getElementById('pageTitle');
  const sidebar = document.getElementById('sidebar');
  const menuButton = document.getElementById('menuButton');
  const loginShell = document.getElementById('authShell');
  const appShell = document.getElementById('appShell');
  const loginForm = document.getElementById('loginForm');
  const loginEmail = document.getElementById('loginEmail');
  const loginPassword = document.getElementById('loginPassword');
  const authMessage = document.getElementById('authMessage');
  const signOutButton = document.getElementById('signOutButton');
  const signedInIdentity = document.getElementById('signedInIdentity');
  const hhaSyncStatus = document.getElementById('hhaSyncStatus');
  const hhaConnectionStatus = document.getElementById('hhaConnectionStatus');
  const syncDetails = document.getElementById('integrationSyncDetails');
  const refreshButton = document.getElementById('refreshIntegration');
  let authSequence = 0;

  function setAuthMessage(text, isError = false) {
    if (!authMessage) return;
    authMessage.textContent = text;
    authMessage.dataset.state = isError ? 'error' : 'info';
  }

  function showLogin(message = '', isError = false) {
    document.dispatchEvent?.(new Event('primetime-signed-out'));
    if (appShell) appShell.hidden = true;
    if (loginShell) loginShell.hidden = false;
    setAuthMessage(message, isError);
  }

  function showApp() {
    if (loginShell) loginShell.hidden = true;
    if (appShell) appShell.hidden = false;
    setAuthMessage('');
  }

  function setHhaStatus(text, ok = false) {
    if (hhaSyncStatus) hhaSyncStatus.textContent = text;
    if (hhaConnectionStatus) {
      hhaConnectionStatus.textContent = ok ? 'Reference API reachable' : text.replace(/^HHA connection:\s*/i, '');
      hhaConnectionStatus.classList.toggle('low', ok);
      hhaConnectionStatus.classList.toggle('pending', !ok);
    }
  }

  function setView(view, updateHash = true) {
    if (!titles[view]) view = 'overview';
    navItems.forEach(item => item.classList.toggle('is-active', item.dataset.view === view));
    panels.forEach(panel => panel.classList.toggle('is-active', panel.dataset.viewPanel === view));
    if (pageTitle) pageTitle.textContent = titles[view];
    if (updateHash) history.replaceState(null, '', view === 'overview' ? '/primetime' : `/primetime#${view}`);
    sidebar?.classList.remove('is-open');
    menuButton?.setAttribute('aria-expanded', 'false');
    if (!appShell?.hidden) document.getElementById('workspace')?.focus({ preventScroll: true });
  }

  navItems.forEach(item => item.addEventListener('click', () => setView(item.dataset.view)));
  document.querySelectorAll('[data-view-jump]').forEach(item => item.addEventListener('click', () => setView(item.dataset.viewJump)));

  menuButton?.addEventListener('click', () => {
    const open = sidebar?.classList.toggle('is-open') ?? false;
    menuButton.setAttribute('aria-expanded', String(open));
  });

  document.addEventListener('click', event => {
    if (
      window.innerWidth <= 820 &&
      sidebar?.classList.contains('is-open') &&
      event.target instanceof Node &&
      !sidebar.contains(event.target) &&
      menuButton &&
      !menuButton.contains(event.target)
    ) {
      sidebar.classList.remove('is-open');
      menuButton.setAttribute('aria-expanded', 'false');
    }
  });

  const search = document.getElementById('exceptionSearch');
  const priority = document.getElementById('priorityFilter');
  const rows = [...document.querySelectorAll('#exceptionTable tbody tr')];

  function filterExceptions() {
    const term = (search?.value || '').trim().toLowerCase();
    const selected = priority?.value || 'all';
    rows.forEach(row => {
      const matchesTerm = !term || row.textContent.toLowerCase().includes(term);
      const matchesPriority = selected === 'all' || row.dataset.priority === selected;
      row.hidden = !(matchesTerm && matchesPriority);
    });
  }

  search?.addEventListener('input', filterExceptions);
  priority?.addEventListener('change', filterExceptions);

  const initial = location.hash.replace('#', '');
  setView(titles[initial] ? initial : 'overview', false);

  if (!window.firebase?.auth) {
    showLogin('Authentication failed to initialize. Refresh the page or contact an administrator.', true);
    return;
  }

  const auth = window.firebase.auth();

  async function apiFetch(path, options = {}) {
    const sequence = authSequence;
    const user = auth.currentUser;
    if (!user) throw new Error('not_authenticated');

    const token = await user.getIdToken();
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', 'Bearer ' + token);

    if (sequence !== authSequence || auth.currentUser !== user) throw new Error('session_changed');
    return fetch(path, {
      ...options,
      headers,
      cache: 'no-store',
      credentials: 'same-origin'
    });
  }

  async function verifyAdminSession(user) {
    const sequence = authSequence;
    const token = await user.getIdToken(true);
    if (sequence !== authSequence || auth.currentUser !== user) throw new Error('session_changed');
    const response = await fetch('/primetime/api/session', {
      headers: { Authorization: 'Bearer ' + token },
      cache: 'no-store',
      credentials: 'same-origin'
    });

    if (!response.ok) {
      throw new Error(response.status === 403 ? 'forbidden' : 'unauthorized');
    }

    return response.json();
  }

  async function refreshHhaHealth() {
    const sequence = authSequence;
    setHhaStatus('HHA connection: checking');
    try {
      const response = await apiFetch('/primetime/api/hha/health');
      const payload = await response.json();
      if (sequence !== authSequence) return;
      if (response.ok && payload?.ok === true && payload.hhaConnection === 'reachable' && payload.operation === 'GetCollectionStatus') {
        setHhaStatus('HHA reference API: reachable; imports not verified', true);
      } else if (response.status === 401 || response.status === 403) {
        setHhaStatus('HHA check: administrator session rejected; sign in again');
      } else {
        const failures = {
          auth_failure: 'HHA reference check: vendor authentication rejected',
          operation_failure: 'HHA reference check: operation failed; access not confirmed',
          unavailable_or_deferred: 'HHA reference check: unavailable or deferred; check backend, storage and throttle state'
        };
        setHhaStatus(failures[payload?.hhaConnection] || 'HHA reference check: unverified response');
      }
    } catch {
      if (sequence === authSequence) setHhaStatus('HHA connection: unavailable');
    }
  }

  async function refreshIntegration() {
    const sequence = authSequence;
    const restoreRefreshFocus = document.activeElement === refreshButton;
    if (refreshButton) refreshButton.disabled = true;
    if (syncDetails) syncDetails.textContent = 'Checking import history…';
    await Promise.all([refreshHhaHealth(), (async () => {
      try {
        const response = await apiFetch('/primetime/api/integration/health');
        const payload = await response.json();
        if (sequence !== authSequence) return;
        if (!response.ok || !payload.ok || !payload.sync) throw new Error('unavailable');
        const sync = payload.sync;
        const states = { never_synced: 'No successful import recorded', running: 'Import running', success: 'Last import succeeded', partial: 'Partial import — replay required', failed: 'Import failed — replay required', unknown: 'Latest import outcome unknown' };
        const lockStatus = sync.singleFlight?.state === 'held_worker_status_requires_verification' ? ' Import lock held: verify the worker status before recovery; no automatic takeover.' : sync.singleFlight?.state === 'available' ? ' Import lock available.' : '';
        const last = sync.lastSuccessfulAt ? new Date(sync.lastSuccessfulAt).toLocaleString() : 'None';
        if (syncDetails) syncDetails.textContent = `${states[sync.state] || states.unknown}. Last successful import: ${last}. Records processed in latest run: ${sync.processedCount}. Rejected: ${sync.deadLetterCount}. Freshness schedule and source validation are pending. Connection checks do not import visits.${lockStatus}`;
      } catch {
        if (sequence === authSequence && syncDetails) syncDetails.textContent = 'Import history unavailable. No current-data claim can be made. Check backend deployment and Firestore setup, then retry.';
      }
    })()]);
    if (sequence === authSequence && refreshButton) {
      refreshButton.disabled = false;
      if (restoreRefreshFocus && document.activeElement === document.body) refreshButton.focus();
    }
  }
  refreshButton?.addEventListener('click', refreshIntegration);

  // This is a contract inventory, not an arbitrary SOAP console. Only the
  // reviewed reference health check is executable; source records stay gated.
  const capabilitySearch = document.getElementById('capabilitySearch');
  const capabilityKind = document.getElementById('capabilityKind');
  const capabilityRows = document.getElementById('capabilityRows');
  const capabilitySummary = document.getElementById('capabilitySummary');
  let capabilities = [];
  function renderCapabilities() {
    if (!capabilityRows) return;
    capabilityRows.replaceChildren();
    const term = (capabilitySearch?.value || '').trim().toLowerCase();
    const selected = capabilities.filter(item => `${item.name} ${item.area}`.toLowerCase().includes(term) && (!capabilityKind?.value || item.kind === capabilityKind.value));
    for (const item of selected) {
      const row = document.createElement('tr');
      for (const value of [item.name, item.area, item.kind, item.implementation]) {
        const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
      }
      const cell = document.createElement('td');
      const details = document.createElement('details');
      const summary = document.createElement('summary'); summary.textContent = 'Requirements and inputs'; details.append(summary);
      const text = document.createElement('p');
      text.textContent = `${item.gate}. Entitlement: ${item.entitlement}. Contract inputs: ${item.parameters.map(p => `${p.name} (${p.type}, ${p.required ? 'required' : 'optional'})`).join(', ') || 'See contract'}.`;
      details.append(text); cell.append(details);
      if (item.executable) {
        const button = document.createElement('button'); button.className = 'btn secondary'; button.textContent = 'Check reference connection'; button.addEventListener('click', refreshIntegration); cell.append(button);
      } else if (item.workspaceRead || item.writePrepared) {
        const button = document.createElement('button'); button.className = 'btn secondary'; button.textContent = 'Open operational tools'; button.addEventListener('click', () => setView('workbench')); cell.append(button);
      } else {
        const label = document.createElement('span'); label.textContent = 'Execution unavailable'; cell.append(label);
      }
      row.append(cell); capabilityRows.append(row);
    }
    if (capabilitySummary) capabilitySummary.textContent = `${selected.length} of ${capabilities.length} contract operations. Contract presence does not confirm account access. Protected workspace reads require deployment approval and owner enablement.`;
  }
  capabilitySearch?.addEventListener('input', renderCapabilities);
  capabilityKind?.addEventListener('change', renderCapabilities);
  if (capabilityRows) fetch('/primetime/hha-capabilities.json', { cache: 'no-store' })
    .then(response => { if (!response.ok) throw new Error('unavailable'); return response.json(); })
    .then(payload => { capabilities = payload.items.map(item => ({ ...item, implementation: payload.implementationStates[item.implementation], area: payload.areas[item.area], parameters: item.parameters.map(([name,type,required]) => ({name,type,required})) })).map(item => ({ ...item, gate: payload.gates[item.executable || item.workspaceRead ? item.implementation : item.kind] + '. ' + payload.guideStatuses[item.guideStatus] + (payload.prerequisites?.[item.name] ? '. Prerequisite: ' + payload.prerequisites[item.name] : ''), entitlement: payload.entitlement })); renderCapabilities(); })
    .catch(() => { if (capabilitySummary) capabilitySummary.textContent = 'Contract inventory unavailable. Refresh to retry.'; });

  loginForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const email = loginEmail?.value.trim() || '';
    const password = loginPassword?.value || '';

    if (!email || !password) {
      setAuthMessage('Enter your email and password.', true);
      return;
    }

    setAuthMessage('Signing in…');
    try {
      await auth.setPersistence(window.firebase.auth.Auth.Persistence.SESSION);
      await auth.signInWithEmailAndPassword(email, password);
    } catch {
      setAuthMessage('Sign-in failed. Check your credentials and try again.', true);
    }
  });

  signOutButton?.addEventListener('click', async () => {
    authSequence += 1;
    showLogin();
    if (syncDetails) syncDetails.textContent = '';
    if (loginPassword) loginPassword.value = '';
    try {
      await auth.signOut();
    } catch {
      showLogin('Sign-out failed. Close this browser session.', true);
    }
  });

  auth.onAuthStateChanged(async user => {
    const sequence = ++authSequence;
    if (!user) {
      showLogin();
      return;
    }

    showLogin('Checking administrator access…');
    try {
      const session = await verifyAdminSession(user);
      if (sequence !== authSequence || auth.currentUser?.uid !== user.uid) return;
      if (session?.ok !== true || !session.roles?.includes('admin')) throw new Error('forbidden');
      if (signedInIdentity) {
        signedInIdentity.textContent = session.email || 'Internal access · sign out';
      }
      showApp();
      document.dispatchEvent?.(new Event('primetime-ready'));
      if (loginPassword) loginPassword.value = '';
      void refreshIntegration();
    } catch {
      if (sequence !== authSequence) return;
      await auth.signOut();
      showLogin('This account is not authorized for Primetime administration.', true);
    }
  });

  window.primetimeApiFetch = apiFetch;
})();
