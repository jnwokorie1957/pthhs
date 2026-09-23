(() => {
  const titles = {
    overview: 'Operations overview', evv: 'EVV exceptions', visits: 'Live visits',
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
  let authSequence = 0;

  function setAuthMessage(text, isError = false) {
    if (!authMessage) return;
    authMessage.textContent = text;
    authMessage.dataset.state = isError ? 'error' : 'info';
  }

  function showLogin(message = '', isError = false) {
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
      hhaConnectionStatus.textContent = ok ? 'Connected' : text.replace(/^HHA sync:\s*/i, '');
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
    const user = auth.currentUser;
    if (!user) throw new Error('not_authenticated');

    const token = await user.getIdToken();
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', 'Bearer ' + token);

    return fetch(path, {
      ...options,
      headers,
      cache: 'no-store',
      credentials: 'same-origin'
    });
  }

  async function verifyAdminSession(user) {
    const token = await user.getIdToken(true);
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
    setHhaStatus('HHA sync: checking');
    try {
      const response = await apiFetch('/primetime/api/hha/health');
      const payload = await response.json();
      if (response.ok && payload?.ok) {
        setHhaStatus('HHA sync: connected', true);
      } else {
        setHhaStatus('HHA sync: needs attention');
      }
    } catch {
      setHhaStatus('HHA sync: unavailable');
    }
  }

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
      void refreshHhaHealth();
    } catch {
      if (sequence !== authSequence) return;
      await auth.signOut();
      showLogin('This account is not authorized for Primetime administration.', true);
    }
  });

  window.primetimeApiFetch = apiFetch;
})();
