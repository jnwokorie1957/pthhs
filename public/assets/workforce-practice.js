(() => {
  const button = document.getElementById('dashboard-practice');
  const dialog = document.getElementById('caregiver-practice');
  const dashboard = document.getElementById('caregiver-dashboard');
  const title = document.getElementById('practice-heading');
  const progress = document.getElementById('practice-progress');
  const content = document.getElementById('practice-fields');
  const back = document.getElementById('practice-back');
  const next = document.getElementById('practice-next');
  const deadline = Date.parse(button.dataset.until);
  const choices = new Map();
  let verified = false;
  let request;
  let timer;
  let steps = [];
  let index = 0;

  function clear() {
    request?.abort();
    request = undefined;
    if (dialog.open) dialog.close();
    choices.clear();
    steps = [];
    content.replaceChildren();
  }

  function available() {
    return verified && Date.now() < deadline;
  }

  function refresh() {
    button.hidden = !available();
    if (button.hidden) clear();
  }

  window.WorkforcePractice = {
    setVerified(value) {
      verified = value;
      clearTimeout(timer);
      refresh();
      if (available()) timer = setTimeout(refresh, Math.max(0, deadline - Date.now()));
    }
  };
  document.addEventListener('visibilitychange', refresh);
  window.addEventListener('pageshow', refresh);
  document.getElementById('practice-close').onclick = clear;
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    clear();
  });

  function element(tag, text) {
    const node = document.createElement(tag);
    node.textContent = text;
    return node;
  }

  function fieldControl(field) {
    const label = element('label', field.label + (field.required ? ' *' : ''));
    const control = document.createElement(field.type === 'choice' ? 'select' : field.type === 'textarea' ? 'textarea' : 'input');
    label.className = 'application-label';
    if (field.type === 'choice') {
      control.append(new Option('Choose an option', ''));
      for (const option of field.options) control.append(new Option(option, option));
    } else if (field.type === 'ssn') {
      control.value = '***-**-1234';
      control.readOnly = true;
    } else {
      if (control.tagName === 'INPUT') control.type = field.type;
      control.autocomplete = 'off';
      control.maxLength = field.maxLength;
    }
    if (choices.has(field.id)) control.value = choices.get(field.id);
    control.addEventListener('input', () => choices.set(field.id, control.value));
    label.append(control);
    return label;
  }

  function render() {
    if (!available() || dashboard.hidden) return clear();
    const step = steps[index];
    content.replaceChildren();
    progress.textContent = step ? `Step ${index + 1} of ${steps.length}` : 'Finished';
    title.textContent = step?.title ?? 'Practice complete';
    back.hidden = index === 0 || !step;
    next.hidden = !step;
    next.textContent = index === steps.length - 1 ? 'Finish practice' : 'Next';
    if (step?.note) content.append(element('p', step.note));
    for (const field of step?.fields ?? []) content.append(fieldControl(field));
    if (!step) {
      choices.clear();
      content.append(element('p', 'Your practice application is complete. Your entries were cleared from this session.'));
    }
    dialog.scrollTop = 0;
    title.focus({preventScroll: true});
  }

  function simulated(label) {
    return {id: label, label, type: 'choice', options: ['Mark complete for practice']};
  }

  button.onclick = async () => {
    if (!available() || dashboard.hidden || dialog.open) return;
    dialog.showModal();
    title.textContent = 'Sample application';
    progress.textContent = 'Loading…';
    back.hidden = next.hidden = true;
    const attempt = new AbortController();
    request = attempt;
    try {
      const response = await fetch('/caregiver/workforce-api/application/packet', {
        cache: 'no-store',
        credentials: 'omit',
        signal: attempt.signal
      });
      if (!response.ok) throw Error();
      const {packet} = await response.json();
      if (request !== attempt) return;
      const grouped = new Map();
      for (const field of packet.fields) {
        if (!grouped.has(field.section)) grouped.set(field.section, {title: field.section, fields: []});
        grouped.get(field.section).fields.push(field);
      }
      grouped.get('PAS attendant role').note = packet.jobDescription.introduction;
      grouped.get('Policies & acknowledgments').note = 'Practice making selections. Policy documents are omitted from this sample.';
      steps = [...grouped.values(),
        {title: 'Identity and insurance documents', note: 'Try the document step using the sample options below.', fields: ['Photo ID', 'Social Security card', 'Health insurance card (optional)'].map(simulated)},
        {title: 'Tax and employment forms', note: 'Use these sample options to simulate completing the forms.', fields: ['W-4', 'I-9', 'Texas New Hire Report', 'DPS Computerized Criminal History Verification'].map(simulated)},
        {title: 'Review', note: 'Use Back to revisit any step, or finish the practice application.', fields: []}
      ];
      index = 0;
      render();
    } catch {
      if (request !== attempt) return;
      progress.textContent = '';
      content.textContent = 'The sample could not be loaded. Close it and try again.';
    } finally {
      if (request === attempt) request = undefined;
    }
  };

  back.onclick = () => { --index; render(); };
  next.onclick = () => { ++index; render(); };
})();
