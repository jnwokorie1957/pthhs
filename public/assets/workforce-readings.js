(() => {
  let urls = [], generation = 0;
  const clear = () => { generation++; urls.forEach(URL.revokeObjectURL); urls = []; };
  window.WorkforceReadings = {
    clear,
    render(target, readings, answers, onChange, submitted) {
      clear(); const sequence = generation; target.replaceChildren();
      const text = (tag, value) => { const node = document.createElement(tag); node.textContent = value; return node; };
      target.append(text('h2', 'Policies & acknowledgments'), text('p', 'Read each original packet page, then acknowledge reading it. Where an agreement is requested, choose whether you agree or want to discuss it with HR first. Training, medical elections and employer signatures remain separate.'));
      for (const reading of readings) {
        const card = document.createElement('article'); card.className = 'packet-reading-card';
        card.append(text('h3', reading.title),text('p','Updated scan: pages ' + reading.sourcePages.join(' and ')));
        if (reading.note) card.append(text('p', reading.note));
        const open = text('button', 'Read scan pages ' + reading.sourcePages.join(' and ')); open.type = 'button'; open.className = 'btn-secondary';
        const image = document.createElement('img'); image.hidden = true; image.className = 'packet-reading-image'; image.alt = 'Original blank packet page ' + reading.page + ': ' + reading.title;
        const zoom = text('a', 'Open full-size page for easier reading'); zoom.target = '_blank'; zoom.rel = 'noopener'; zoom.hidden = true;
        const status = text('p', ''); status.setAttribute('role', 'status');
        const label = document.createElement('label'); label.className = 'application-check';
        const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.id = 'application-read_page_' + reading.page;
        checkbox.checked = answers['read_page_' + reading.page] === 'Read'; checkbox.disabled = submitted || !checkbox.checked; checkbox.setAttribute('aria-required', 'true');
        checkbox.onchange = () => onChange('read_page_' + reading.page, checkbox.checked ? 'Read' : '');
        label.append(checkbox, text('span', 'I have read this page. *'));
        open.onclick = async () => {
          open.disabled = true; status.textContent = 'Loading original page…';
          try {
            const blob = await workforceApi('/application/reading-pages/' + reading.page, undefined, true);
            if (sequence !== generation) return;
            const url = URL.createObjectURL(blob); urls.push(url); image.src = url; image.hidden = false; zoom.href = url; zoom.hidden = false; checkbox.disabled = submitted;
            if(reading.hasContinuation){
              checkbox.disabled = true;
              const second = await workforceApi('/application/reading-pages/' + reading.page + '/2',undefined,true);
              if(sequence!==generation)return;
              const secondUrl=URL.createObjectURL(second);urls.push(secondUrl);
              const continuation=document.createElement('img');continuation.className='packet-reading-image';continuation.src=secondUrl;continuation.alt='Continuation: '+reading.title;
              const full=text('a','Open continuation full size');full.href=secondUrl;full.target='_blank';full.rel='noopener';
              image.after(full,continuation);checkbox.disabled=submitted;
            }
            status.textContent = 'Read the complete page below. You can open it full size to zoom.';
          } catch { status.textContent = 'The page could not be loaded. Try again before acknowledging it.'; }
          finally { open.disabled = false; }
        };
        card.append(open, status, zoom, image, label);
        if (reading.agreement) {
          const response = document.createElement('label'); response.className = 'application-label'; response.append(text('span', 'Your response *'));
          const select = document.createElement('select'); select.id = 'application-terms_page_' + reading.page; select.disabled = submitted; select.setAttribute('aria-required', 'true');
          for (const value of ['', 'I agree', 'I have questions for HR before agreeing']) { const option = text('option', value || 'Choose your response'); option.value = value; select.append(option); }
          select.value = answers['terms_page_' + reading.page] || ''; select.onchange = () => onChange('terms_page_' + reading.page, select.value); response.append(select); card.append(response);
        }
        target.append(card);
      }
    }
  };
})();
