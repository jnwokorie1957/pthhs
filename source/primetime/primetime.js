(() => {
  // Keep the one-time action link in memory before navigation can replace it.
  const initialSignInHref = location.href || '';
  const titles = {
    workbench: 'Advanced tools', revisions: 'Visit review',
    overview: 'Operations overview', evv: 'EVV exceptions', visits: 'Visits',
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
  const loginSubmit = document.getElementById('loginSubmit');
  const emailMethod = document.getElementById('emailMethod');
  const phoneMethod = document.getElementById('phoneMethod');
  const phoneForm = document.getElementById('phoneLoginForm');
  const loginPhone = document.getElementById('loginPhone');
  const phoneCode = document.getElementById('phoneCode');
  const phoneSubmit = document.getElementById('phoneSubmit');
  const newPhoneCode = document.getElementById('requestNewPhoneCode');
  const retrySession = document.getElementById('retrySession');
  const requestNewLink = document.getElementById('requestNewLink');
  const authCopy = document.getElementById('authCopy');
  const authMessage = document.getElementById('authMessage');
  const signOutButton = document.getElementById('signOutButton');
  const signedInIdentity = document.getElementById('signedInIdentity');
  const hhaSyncStatus = document.getElementById('hhaSyncStatus');
  const hhaConnectionStatus = document.getElementById('hhaConnectionStatus');
  const syncDetails = document.getElementById('integrationSyncDetails');
  const refreshButton = document.getElementById('refreshIntegration');
  let authSequence = 0;
  let pendingSignInLink = '';
  let authBusy = false;
  let activeSignInAttempt = null;
  let handledAuthUser;
  let signInMethod = 'email';
  let phoneConfirmation = null;
  let phoneVerifier = null;
  let persistenceReady;
  const pendingEmailKey = 'primetime.emailForSignIn';

  function savedSignInEmail(action, email) {
    try {
      if (action === 'save') window.localStorage.setItem(pendingEmailKey, email);
      else if (action === 'clear') window.localStorage.removeItem(pendingEmailKey);
      else return window.localStorage.getItem(pendingEmailKey) || '';
    } catch {
      // Storage is optional: the same form supports email confirmation.
    }
    return '';
  }

  function updateSignInForm() {
    if (loginForm) loginForm.hidden = signInMethod !== 'email';
    if (phoneForm) phoneForm.hidden = signInMethod !== 'phone';
    for (const [button, method] of [[emailMethod, 'email'], [phoneMethod, 'phone']]) {
      button?.setAttribute('aria-pressed', String(signInMethod === method));
      if (button) button.disabled = authBusy || Boolean(pendingSignInLink);
    }
    if (loginPhone) loginPhone.disabled = authBusy || Boolean(phoneConfirmation);
    if (phoneCode) { phoneCode.disabled = authBusy; phoneCode.required = Boolean(phoneConfirmation); }
    const codeFields = document.getElementById('phoneCodeFields');
    if (codeFields) codeFields.hidden = !phoneConfirmation;
    if (phoneSubmit) { phoneSubmit.disabled = authBusy; phoneSubmit.textContent = phoneConfirmation ? 'Verify code' : 'Send text code'; }
    if (newPhoneCode) { newPhoneCode.hidden = !phoneConfirmation; newPhoneCode.disabled = authBusy; }
    if (loginSubmit) {
      loginSubmit.disabled = authBusy;
      loginSubmit.textContent = pendingSignInLink ? 'Finish sign in' : 'Send sign-in link';
    }
    if (requestNewLink) {
      requestNewLink.hidden = !pendingSignInLink;
      requestNewLink.disabled = authBusy;
    }
    if (loginEmail) loginEmail.disabled = authBusy;
    if (authCopy) authCopy.textContent = signInMethod === 'phone'
      ? phoneConfirmation ? 'Enter the six-digit code sent to your phone.' : 'Enter your approved US phone number to receive a sign-in code.'
      : pendingSignInLink
      ? 'Confirm the email address that received this sign-in link, then finish signing in.'
      : 'Enter your approved administrator email. We will email you a link to sign in.';
  }

  function setAuthMessage(text, isError = false) {
    if (!authMessage) return;
    authMessage.textContent = text;
    authMessage.dataset.state = isError ? 'error' : 'info';
  }

  function showLogin(message = '', isError = false, preserveDataMode = false) {
    const event = new Event('primetime-signed-out');
    event.preserveDataMode = preserveDataMode;
    document.dispatchEvent?.(event);
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
    if (typeof CustomEvent === 'function') document.dispatchEvent?.(new CustomEvent('primetime-view-changed', { detail: { view } }));
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

  function filterExceptions() {
    const term = (search?.value || '').trim().toLowerCase();
    const selected = priority?.value || 'all';
    document.querySelectorAll('#exceptionTable tbody tr').forEach(row => {
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
  function persistSignIn() {
    // Migrate existing SESSION users in place. Never clear or revoke a session
    // to change persistence; a storage failure keeps the current SDK session.
    if (!persistenceReady) persistenceReady = auth.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL)
      .catch(() => { persistenceReady = null; });
    return persistenceReady;
  }
  function clearPhoneChallenge() {
    phoneVerifier?.clear();
    phoneVerifier = null;
  }
  function resetPhoneSignIn() {
    phoneConfirmation = null;
    if (phoneCode) phoneCode.value = '';
    clearPhoneChallenge();
  }
  function selectSignInMethod(method) {
    if (authBusy || pendingSignInLink) return;
    resetPhoneSignIn();
    signInMethod = method;
    updateSignInForm();
    setAuthMessage('');
    (method === 'phone' ? loginPhone : loginEmail)?.focus();
  }
  emailMethod?.addEventListener('click', () => selectSignInMethod('email'));
  phoneMethod?.addEventListener('click', () => selectSignInMethod('phone'));
  newPhoneCode?.addEventListener('click', () => {
    if (authBusy) return;
    resetPhoneSignIn();
    updateSignInForm();
    setAuthMessage('Confirm your phone number and send a new code.');
  });
  if (auth.isSignInWithEmailLink(initialSignInHref)) {
    pendingSignInLink = initialSignInHref;
    if (loginEmail) loginEmail.value = savedSignInEmail('read');
    // Never keep the action code in the visible URL or put an email in it.
    history.replaceState(null, '', '/primetime');
  }
  updateSignInForm();

  async function apiFetch(path, options = {}) {
    const sequence = authSequence;
    const user = auth.currentUser;
    if (!user) throw new Error('not_authenticated');
    if (typeof path !== 'string' || !path.startsWith('/primetime/api/')) throw new Error('invalid_api_path');
    const controller = window.primetimeDataMode;
    const mode = controller?.getMode() || 'demo';
    const modeGeneration = controller?.getGeneration();
    const method = (options.method || 'GET').toUpperCase();
    const safeMetadata = method === 'GET' && ['/primetime/api/session', '/primetime/api/status', '/primetime/api/data/status'].includes(path.split('?')[0]);
    if (mode !== 'live' && !safeMetadata) throw new Error('demo_mode_source_requests_disabled');
    if (controller?.isActive?.() === false) throw new Error('not_authenticated');
    const check = () => {
      if (sequence !== authSequence || auth.currentUser !== user) throw new Error('session_changed');
      if (modeGeneration !== controller?.getGeneration() || mode !== (controller?.getMode() || 'demo')) throw new Error('data_mode_changed');
    };
    const token = await user.getIdToken();
    check();
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', 'Bearer ' + token);
    headers.set('X-Primetime-Data-Mode', mode);
    const abort = typeof AbortController === 'function' ? new AbortController() : null;
    const untrack = abort ? controller?.trackRequest?.(abort) : null;
    const cancel = () => abort?.abort();
    if (options.signal?.aborted) cancel();
    options.signal?.addEventListener('abort', cancel, { once: true });
    const release = () => { untrack?.(); options.signal?.removeEventListener('abort', cancel); };
    const guardedResponse = response => new Proxy(response, {
      get(target, property) {
        if (property === 'clone') return () => { check(); return guardedResponse(target.clone()); };
        // Raw streams bypass the mode/session guard; use a fenced body method.
        if (property === 'body') {
          if (target.body == null) return null;
          throw new Error('api_response_stream_not_supported');
        }
        if (['json', 'text', 'blob', 'arrayBuffer', 'formData', 'bytes'].includes(property)) return async (...args) => {
          try { check(); const result = await target[property](...args); check(); return result; }
          finally { release(); }
        };
        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      }
    });
    try {
      const response = await fetch(path, {
        ...options, headers, ...(abort ? { signal: abort.signal } : {}),
        cache: 'no-store', credentials: 'same-origin'
      });
      check();
      // A mode change can happen after headers arrive but before JSON completes.
      // Fence both moments so source records cannot reappear in a new mode.
      return guardedResponse(response);
    } catch (error) {
      release();
      check();
      throw error;
    }
  }

  async function verifyAdminSession(user) {
    const sequence = authSequence;
    const token = await user.getIdToken();
    if (sequence !== authSequence || auth.currentUser !== user) throw new Error('session_changed');
    const response = await fetch('/primetime/api/session', {
      headers: { Authorization: 'Bearer ' + token },
      cache: 'no-store',
      credentials: 'same-origin'
    });

    if (!response.ok) throw new Error(response.status === 403 ? 'forbidden' : response.status === 401 ? 'unauthorized' : 'session_unavailable');

    return response.json();
  }

  async function refreshHhaHealth() {
    const sequence = authSequence;
    const modeGeneration = window.primetimeDataMode?.getGeneration();
    const current = () => sequence === authSequence && window.primetimeDataMode?.isLive() === true && modeGeneration === window.primetimeDataMode.getGeneration();
    if (!current()) return;
    setHhaStatus('HHA connection: checking');
    try {
      const response = await apiFetch('/primetime/api/hha/health');
      const payload = await response.json();
      if (!current()) return;
      if (response.ok && payload?.ok === true && payload.hhaConnection === 'reachable' && payload.operation === 'GetCollectionStatus') {
        setHhaStatus(payload.readiness?.authentication === 'accepted' ? 'HHA authentication accepted; live reference read succeeded' : 'HHA reference API: reachable; imports not verified', true);
      } else if (response.status === 401 || response.status === 403) {
        setHhaStatus('HHA check: administrator session rejected; sign in again');
      } else {
        const failures = {
          auth_failure: 'HHA reference check: vendor authentication rejected',
          operation_failure: 'HHA reference check: operation failed; access not confirmed',
          unavailable_or_deferred: 'HHA reference check: unavailable or deferred; check backend, storage and throttle state'
        };
        const diagnostics = {
          hha_credentials_unavailable_or_invalid: 'HHA reference check: backend credentials unavailable or invalid',
          vendor_backoff_active: 'HHA reference check: vendor retry delay active; retry later',
          read_budget_exhausted_retry_next_minute: 'HHA reference check: shared read limit reached; retry next minute',
          hha_read_budget_storage_unavailable: 'HHA reference check: request-budget storage unavailable',
          hha_backoff_storage_unavailable: 'HHA reference check: retry-delay storage unavailable',
          hha_authentication_rejected: 'HHA reference check: vendor authentication rejected',
          hha_transport_unavailable: 'HHA reference check: vendor connection unavailable',
          hha_application_rejected: 'HHA reference check: vendor rejected this operation; access not confirmed',
          hha_soap_fault: 'HHA reference check: vendor SOAP fault; access not confirmed',
          hha_response_not_accepted: 'HHA reference check: vendor response could not be verified'
        };
        setHhaStatus(diagnostics[payload?.error] || failures[payload?.hhaConnection] || 'HHA reference check: unverified response');
      }
    } catch {
      if (current()) setHhaStatus('HHA connection: unavailable');
    }
  }

  async function refreshIntegration() {
    const sequence = authSequence;
    const modeGeneration = window.primetimeDataMode?.getGeneration();
    const current = () => sequence === authSequence && window.primetimeDataMode?.isLive() === true && modeGeneration === window.primetimeDataMode.getGeneration();
    if (!current()) return;
    const restoreRefreshFocus = document.activeElement === refreshButton;
    if (refreshButton) refreshButton.disabled = true;
    if (syncDetails) syncDetails.textContent = 'Checking import history…';
    await Promise.all([refreshHhaHealth(), (async () => {
      try {
        const response = await apiFetch('/primetime/api/integration/health');
        const payload = await response.json();
        if (!current()) return;
        if (!response.ok || !payload.ok || !payload.sync) throw new Error('unavailable');
        const sync = payload.sync;
        const states = { never_synced: 'No successful import recorded', running: 'Import running', success: 'Last import succeeded', partial: 'Partial import — replay required', failed: 'Import failed — replay required', unknown: 'Latest import outcome unknown' };
        const lockStatus = sync.singleFlight?.state === 'held_worker_status_requires_verification' ? ' Import lock held: verify the worker status before recovery; no automatic takeover.' : sync.singleFlight?.state === 'available' ? ' Import lock available.' : '';
        const last = sync.lastSuccessfulAt ? new Date(sync.lastSuccessfulAt).toLocaleString() : 'None';
        if (syncDetails) syncDetails.textContent = `${states[sync.state] || states.unknown}. Last successful import: ${last}. Records processed in latest run: ${sync.processedCount}. Rejected: ${sync.deadLetterCount}. Freshness schedule and source validation are pending. Connection checks and on-demand source pages do not import visits or advance this history.${lockStatus}`;
      } catch {
        if (current() && syncDetails) syncDetails.textContent = 'Import history unavailable. No current-data claim can be made. Check backend deployment and Firestore setup, then retry.';
      }
    })()]);
    if (current() && refreshButton) {
      refreshButton.disabled = false;
      if (restoreRefreshFocus && document.activeElement === document.body) refreshButton.focus();
    }
  }
  refreshButton?.addEventListener('click', refreshIntegration);
  document.addEventListener('primetime-data-mode-changed', () => {
    if (refreshButton) refreshButton.disabled = !window.primetimeDataMode?.isLive();
    setHhaStatus(window.primetimeDataMode?.isLive() ? 'HHA connection: not checked' : 'Demo mode: HHA checks paused');
    if (syncDetails) syncDetails.textContent = window.primetimeDataMode?.isLive() ? 'Select Check connection and history to read reference connectivity and persisted import history. This does not start an import.' : 'Demo mode uses sample data. No live import or HHA check runs.';
  });

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
    if (authBusy) return;
    const email = loginEmail?.value.trim() || '';

    if (!email) {
      setAuthMessage('Enter your email address.', true);
      return;
    }

    const link = pendingSignInLink;
    const sequence = authSequence;
    const attempt = link ? { beforeUser: auth.currentUser, changes: [], cancelled: false } : null;
    activeSignInAttempt = attempt;
    authBusy = true;
    updateSignInForm();
    setAuthMessage(link ? 'Finishing sign in…' : 'Sending sign-in link…');
    try {
      await persistSignIn();
      if (attempt?.cancelled || (!link && sequence !== authSequence)) return;
      if (!link) {
        await auth.sendSignInLinkToEmail(email, {
          url: 'https://pthhs.net/primetime',
          handleCodeInApp: true
        });
        if (sequence !== authSequence) return;
        savedSignInEmail('save', email);
        setAuthMessage('Check your email for a sign-in link. Open it to finish signing in.');
      } else {
        const result = await auth.signInWithEmailLink(email, link);
        await completeSignIn(result, attempt);
      }
    } catch (error) {
      if (attempt?.cancelled || (!link && sequence !== authSequence)) return;
      if (link && (error?.code === 'auth/expired-action-code' || error?.code === 'auth/invalid-action-code')) {
        pendingSignInLink = '';
        savedSignInEmail('clear');
        setAuthMessage('This sign-in link is invalid or expired. Request a new link.', true);
      } else {
        setAuthMessage(link
          ? 'Sign-in failed. Confirm the email address that received the link, or request a new link.'
          : 'The sign-in email could not be sent. Try again or contact an administrator.', true);
      }
    } finally {
      if (activeSignInAttempt === attempt) activeSignInAttempt = null;
      authBusy = false;
      updateSignInForm();
    }
  });

  async function completeSignIn(result, attempt) {
    const changed = attempt.cancelled || auth.currentUser !== result.user
      || attempt.changes.some(user => user !== attempt.beforeUser && user !== result.user);
    if (changed) {
      // Never sign out a different current user when a stale request finishes.
      if (auth.currentUser === result.user) await auth.signOut();
      pendingSignInLink = '';
      savedSignInEmail('clear');
      resetPhoneSignIn();
      if (activeSignInAttempt === attempt) showLogin('Sign-in changed before it finished. Start sign in again.', true);
      return;
    }
    pendingSignInLink = '';
    savedSignInEmail('clear');
    resetPhoneSignIn();
    activeSignInAttempt = null;
    handledAuthUser = undefined;
    await handleAuthState(result.user);
  }

  function approvedUsPhone(value) {
    if (typeof value !== 'string' || value.length > 40 || !/^\+?[\d\s().-]+$/.test(value.trim())) return null;
    const digits = value.replace(/\D/g, '');
    const national = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
    return national === '8324030094' ? '+18324030094' : null;
  }
  phoneForm?.addEventListener('submit', async event => {
    event.preventDefault();
    if (authBusy || signInMethod !== 'phone') return;
    const phone = approvedUsPhone(loginPhone?.value || '');
    if (!phone) { setAuthMessage('Enter your approved US phone number.', true); return; }
    const confirmation = phoneConfirmation;
    const code = phoneCode?.value.trim() || '';
    if (confirmation && !/^\d{6}$/.test(code)) { setAuthMessage('Enter the six-digit verification code.', true); return; }
    const sequence = authSequence;
    const attempt = confirmation ? { beforeUser: auth.currentUser, changes: [], cancelled: false } : null;
    activeSignInAttempt = attempt;
    authBusy = true;
    updateSignInForm();
    setAuthMessage(confirmation ? 'Verifying code…' : 'Sending verification code…');
    try {
      await persistSignIn();
      if (attempt?.cancelled || (!confirmation && sequence !== authSequence)) return;
      if (confirmation) {
        await completeSignIn(await confirmation.confirm(code), attempt);
      } else {
        clearPhoneChallenge();
        phoneVerifier = new window.firebase.auth.RecaptchaVerifier('phoneRecaptcha', { size: 'normal' });
        const result = await auth.signInWithPhoneNumber(phone, phoneVerifier);
        if (sequence !== authSequence) return;
        phoneConfirmation = result;
        clearPhoneChallenge();
        setAuthMessage('Check your phone and enter the six-digit code.');
      }
    } catch (error) {
      if (attempt?.cancelled || (!confirmation && sequence !== authSequence)) return;
      if (!confirmation) clearPhoneChallenge();
      const messages = {
        'auth/invalid-verification-code': 'That code is incorrect. Check the text and try again.',
        'auth/code-expired': 'That code expired. Send a new code.',
        'auth/too-many-requests': 'Too many attempts. Wait before requesting another code.',
        'auth/operation-not-allowed': 'Text-message sign-in is not configured yet. Use an email link.',
        'auth/captcha-check-failed': 'Phone verification could not finish. Try the security check again.'
      };
      setAuthMessage(messages[error?.code] || 'Phone sign-in could not finish. Try again or use an email link.', true);
    } finally {
      if (activeSignInAttempt === attempt) activeSignInAttempt = null;
      authBusy = false;
      updateSignInForm();
      if (phoneConfirmation && !confirmation) phoneCode?.focus();
    }
  });

  requestNewLink?.addEventListener('click', () => {
    if (authBusy) return;
    pendingSignInLink = '';
    savedSignInEmail('clear');
    resetPhoneSignIn();
    updateSignInForm();
    showLogin('Enter your email to request a new sign-in link.');
    loginEmail?.focus();
  });

  signOutButton?.addEventListener('click', async () => {
    if (activeSignInAttempt) activeSignInAttempt.cancelled = true;
    authSequence += 1;
    pendingSignInLink = '';
    savedSignInEmail('clear');
    resetPhoneSignIn();
    if (retrySession) retrySession.hidden = true;
    showLogin();
    if (syncDetails) syncDetails.textContent = '';
    updateSignInForm();
    try {
      await auth.signOut();
    } catch {
      showLogin('Sign-out failed. Close this browser session.', true);
    }
  });

  async function handleAuthState(user) {
    // The completion promise and SDK observer can report the same sign-in.
    if (!activeSignInAttempt && !pendingSignInLink && user && handledAuthUser === user) return;
    const sequence = ++authSequence;
    if (activeSignInAttempt) {
      activeSignInAttempt.changes.push(user);
      showLogin('Finishing sign in…');
      return;
    }
    if (pendingSignInLink) {
      showLogin('Confirm the email address that received this sign-in link.');
      return;
    }
    const priorUser = handledAuthUser;
    handledAuthUser = user;
    if (!user) {
      showLogin();
      return;
    }

    if (priorUser && priorUser !== user) window.primetimeDataMode?.reset();
    showLogin('Checking administrator access…', false, true);
    try {
      const session = await verifyAdminSession(user);
      if (sequence !== authSequence || auth.currentUser?.uid !== user.uid) return;
      if (session?.ok !== true || !session.roles?.includes('admin')) throw new Error('forbidden');
      if (signedInIdentity) {
        signedInIdentity.textContent = session.email || session.phoneNumber || 'Internal access · sign out';
      }
      await persistSignIn();
      if (sequence !== authSequence || auth.currentUser !== user) return;
      if (retrySession) retrySession.hidden = true;
      showApp();
      document.dispatchEvent?.(new Event('primetime-ready'));
      if (window.primetimeDataMode?.isLive()) void refreshIntegration();
    } catch (error) {
      if (sequence !== authSequence) return;
      if (error?.message === 'forbidden') {
        await auth.signOut();
        showLogin('This account is not authorized for Primetime administration.', true);
      } else {
        // A temporary network/backend failure must not discard a valid refresh
        // token or make existing users request a new email link/SMS code.
        handledAuthUser = undefined;
        showLogin('Your sign-in is saved. We could not check access. Retry the connection.', true, true);
        if (retrySession) retrySession.hidden = false;
      }
    }
  }
  retrySession?.addEventListener('click', () => { handledAuthUser = undefined; void handleAuthState(auth.currentUser); });
  auth.onAuthStateChanged(handleAuthState);

  window.primetimeApiFetch = apiFetch;
})();
