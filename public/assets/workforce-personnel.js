(() => {
  const panel = document.getElementById('personnel-workspace');
  if (!panel) return;
  let generation = 0, actor;
  const status = document.getElementById('personnel-message'), list = document.getElementById('personnel-list'), detail = document.getElementById('personnel-detail');
  const node = (tag, text) => { const element = document.createElement(tag); element.textContent = text; return element; };
  document.addEventListener('workforce-session-cleared', () => { generation++; actor = null; panel.hidden = true; list.replaceChildren(); detail.replaceChildren(); });
  document.addEventListener('workforce-session', event => {
    generation++; actor = event.detail;
    panel.hidden = !(['hr', 'owner'].includes(actor.grant.role) && actor.grant.permissions.includes('applications.review'));
  });
  async function open(uid) {
    const sequence = generation; detail.replaceChildren();
    try {
      const response = await workforceApi('/staff/applications/' + encodeURIComponent(uid));
      if (sequence !== generation) return;
      const application = response.application;
      detail.append(node('h3', 'Application · ' + application.state), node('p', 'Office: ' + application.office + ' · Packet: ' + application.packetVersion));
      const dl = document.createElement('dl');
      for (const [key, value] of Object.entries(application.answers)) dl.append(node('dt', key), node('dd', key === 'ssn' ? '•••-••-' + String(value).replace(/\D/g, '').slice(-4) : key === 'birthDate' ? 'Restricted identity information supplied' : value || 'Not entered'));
      detail.append(dl);
      if (application.signature) detail.append(node('p', 'Reference release signed by ' + application.signature.name + ' at ' + application.signature.signedAt + '. Source hash and answer-version evidence are retained.'));
      if (!actor.grant.permissions.includes('documents.review')) return;
      const docs = await workforceApi('/staff/applications/' + encodeURIComponent(uid) + '/documents');
      if (sequence !== generation) return;
      detail.append(node('h3', 'Private document folder'));
      for (const doc of docs.items) {
        const button = node('button', doc.kind.replaceAll('_', ' ') + ' · ' + doc.state.replaceAll('_', ' ')); button.type = 'button';
        button.disabled = doc.state !== 'pending_review';
        button.onclick = async () => {
          try {
            const blob = await workforceApi('/staff/applications/' + encodeURIComponent(uid) + '/documents/' + encodeURIComponent(doc.id), undefined, true);
            if (sequence !== generation) return;
            const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = 'private-personnel-document.jpg'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
          } catch (error) { if (sequence === generation) status.textContent = error.message; }
        };
        detail.append(button);
      }
    } catch (error) { if (sequence === generation) status.textContent = error.message; }
  }
  document.getElementById('personnel-refresh').onclick = async () => {
    const sequence = generation;
    try {
      const response = await workforceApi('/staff/applications'); if (sequence !== generation) return;
      list.replaceChildren(); status.textContent = response.items.length + ' applications in your authorized offices (up to 50 per office).';
      for (const item of response.items) {
        const button = node('button', item.uid + ' · ' + item.state + (item.weeklyHours ? ' · ' + item.weeklyHours + ' hours requested' : '') + (item.hoursReviewRequired ? ' · 40 HOURS: OFFICE REVIEW REQUIRED' : ''));
        if (item.hoursReviewRequired) button.className = 'hours-review-notice';
        button.type = 'button'; button.onclick = () => open(item.uid); list.append(button);
      }
    } catch (error) { if (sequence === generation) status.textContent = error.message; }
  };
})();
