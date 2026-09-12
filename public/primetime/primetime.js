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

  function setView(view, updateHash = true) {
    if (!titles[view]) view = 'overview';
    navItems.forEach(item => item.classList.toggle('is-active', item.dataset.view === view));
    panels.forEach(panel => panel.classList.toggle('is-active', panel.dataset.viewPanel === view));
    pageTitle.textContent = titles[view];
    if (updateHash) history.replaceState(null, '', view === 'overview' ? '/primetime' : `/primetime#${view}`);
    sidebar.classList.remove('is-open');
    menuButton?.setAttribute('aria-expanded', 'false');
    document.getElementById('workspace')?.focus({ preventScroll: true });
  }

  navItems.forEach(item => item.addEventListener('click', () => setView(item.dataset.view)));
  document.querySelectorAll('[data-view-jump]').forEach(item => item.addEventListener('click', () => setView(item.dataset.viewJump)));

  menuButton?.addEventListener('click', () => {
    const open = sidebar.classList.toggle('is-open');
    menuButton.setAttribute('aria-expanded', String(open));
  });

  document.addEventListener('click', event => {
    if (window.innerWidth <= 820 && sidebar.classList.contains('is-open') && !sidebar.contains(event.target) && !menuButton.contains(event.target)) {
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
})();
