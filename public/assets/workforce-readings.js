(() => {
  let generation = 0;
  const clear = () => { generation++; };
  const text = (tag, value) => { const node = document.createElement(tag); node.textContent = value; return node; };
  // Text only: never interpret the supplied document as HTML.
  function documentBody(target, content, name) {
    let list = null;
    for (const line of content.replaceAll('{{employee}}', name || 'the applicant').split('\n')) {
      if (!line.trim()) { list = null; continue; }
      const kind = line.startsWith('- ') ? 'ul' : line.startsWith('1. ') ? 'ol' : null;
      if (kind) {
        if (!list || list.tagName.toLowerCase() !== kind) { list = document.createElement(kind); target.append(list); }
        list.append(text('li', line.slice(kind === 'ul' ? 2 : 3)));
      } else { list = null; target.append(text(line.startsWith('## ') ? 'h4' : 'p', line.replace(/^## /, ''))); }
    }
  }
  window.WorkforceReadings = {
    clear,
    render(target, readings, answers, onChange, submitted) {
      clear(); const sequence = generation; target.replaceChildren();
      target.append(text('h2', 'Policies & acknowledgments'));
      for (const reading of readings) {
        const card = document.createElement('article'); card.className = 'packet-reading-card';
        const heading = document.createElement('h3');
        const open = text('button', reading.title); open.type = 'button'; open.className = 'policy-title-button';
        open.setAttribute('aria-expanded', 'false'); open.setAttribute('aria-controls', 'policy-document-' + reading.page);
        heading.append(open); card.append(heading);
        const body = document.createElement('div'); body.id = 'policy-document-' + reading.page; body.hidden = true; body.className = 'policy-document';
        const status = text('p', ''); status.setAttribute('role', 'status'); status.hidden = true;
        const label = document.createElement('label'); label.className = 'application-check';
        const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.id = 'application-read_page_' + reading.page;
        const readId = 'read_page_' + reading.page, termsId = 'terms_page_' + reading.page;
        let choice = answers[termsId];
        const election = reading.election;
        checkbox.checked = answers[readId] === 'Read' && (!reading.agreement || choice === 'I agree')
          && (!election || election.includes(choice));
        checkbox.disabled = true; checkbox.setAttribute('aria-required', 'true');
        checkbox.onchange = () => {
          onChange(readId, checkbox.checked ? 'Read' : '');
          if (reading.agreement) onChange(termsId, checkbox.checked ? 'I agree' : '');
          status.hidden = true;
        };
        label.append(checkbox, text('span', 'I read and I agree. *'));
        let loaded = false;
        open.onclick = async () => {
          if (loaded) { body.hidden = !body.hidden; open.setAttribute('aria-expanded', String(!body.hidden)); return; }
          open.disabled = true; status.textContent = 'Loading…'; status.hidden = false;
          try {
            const doc = await workforceApi('/application/reading-documents/' + reading.page);
            if (sequence !== generation) return;
            const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(doc.text));
            const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
            if (doc.edition !== reading.edition || hash !== reading.contentSha256 || doc.contentSha256 !== hash) throw Error('Document changed');
            if (sequence !== generation) return;
            const company = text('p', 'Primetime Home Health Services, Inc.'); company.className = 'policy-company'; body.append(company);
            documentBody(body, doc.text, [answers.firstName, answers.lastName].filter(Boolean).join(' '));
            if (reading.note) { const note = text('p', reading.note); note.className = 'policy-note'; body.append(note); }
            if (election) {
              const group = document.createElement('fieldset');
              group.append(text('legend', 'Health insurance coverage *'));
              election.forEach((value, index) => {
                const row = document.createElement('label');
                row.className = 'application-check';
                const option = document.createElement('input');
                option.type = 'radio';
                option.name = termsId;
                option.id = 'application-' + termsId + (index ? '-' + index : '');
                option.value = value;
                option.checked = value === choice;
                option.setAttribute('aria-required', 'true');
                option.disabled = submitted;
                option.onchange = () => {
                  if (!option.checked) return;
                  choice = value;
                  checkbox.checked = false;
                  checkbox.disabled = false;
                  onChange(readId, '');
                  onChange(termsId, value);
                };
                row.append(option, text('span', value));
                group.append(row);
              });
              body.append(group);
            }
            body.hidden = false; loaded = true; open.setAttribute('aria-expanded', 'true');
            checkbox.disabled = submitted || !!election && !election.includes(choice);
            status.hidden = true;
          } catch { status.textContent = 'Unable to load. Please try again.'; status.hidden = false; }
          finally { open.disabled = false; }
        };
        card.append(body, label, status); target.append(card);
      }
    }
  };
})();
