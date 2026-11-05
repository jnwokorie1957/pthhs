(() => {
  const form = document.getElementById('opportunity-filters');
  const list = document.getElementById('opportunity-list');
  const status = document.getElementById('opportunity-status');
  if (!form || !list) return;
  let items = [], releasePending = false;
  function render() {
    const filter = Object.fromEntries(new FormData(form));
    const selected = items.filter(o => WorkforceContract.matches(o, filter));
    list.replaceChildren();
    status.textContent = releasePending
      ? 'Online opportunities are being prepared. Please contact Primetime about current opportunities or a general employment application.'
      : selected.length ? selected.length + ' available opportunities'
        : items.length ? 'No opportunities match these filters.'
          : 'No approved opportunities are currently listed. You may still contact Primetime about a general employment application.';
    for (const o of selected) {
      const card = document.createElement('article'); card.className = 'card';
      const heading = document.createElement('h3'); heading.textContent = o.location;
      const details = document.createElement('p');
      details.textContent = [o.recruitingZip ? 'Work-area ZIP ' + o.recruitingZip : 'Broad recruiting area',
        'Approximately ' + o.weeklyHours + ' hours/week', o.schedule, o.type, o.status].join(' · ');
      const needs = document.createElement('p'); needs.textContent = o.assistance.map(n => n.replaceAll('_', ' ')).join(', ');
      const link = document.createElement('a'); link.className = 'btn-secondary';
      link.textContent = "I'm Interested"; link.href = '/caregiver?opportunity=' + encodeURIComponent(o.id);
      card.append(heading, details, needs, link); list.append(card);
    }
  }
  form.addEventListener('input', render);
  form.addEventListener('submit', event => { event.preventDefault(); render(); });
  fetch('/caregiver/workforce-api/opportunities', { cache: 'no-store' }).then(async r => {
    if (!r.ok) throw Error();
    const body = await r.json();
    if (!Array.isArray(body.items)) throw Error();
    releasePending = body.release === 'pending'; items = body.items; render();
  }).catch(() => { status.textContent = 'Opportunities are unavailable right now. Please retry or call 713-977-7721. Availability has not been verified.'; });
})();
