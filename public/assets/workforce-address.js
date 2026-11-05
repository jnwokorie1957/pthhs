(() => {
  window.WorkforceAddress = {
    attach(input, onSelect, enabled) {
      if (!enabled) return () => {};
      let timer, generation = 0, token = crypto.randomUUID(), active = -1;
      const results = document.createElement('div'); results.className = 'address-suggestions'; results.hidden = true;
      results.id = 'street-address-suggestions'; results.setAttribute('role', 'listbox');
      const status = document.createElement('span'); status.className = 'address-status'; status.setAttribute('role', 'status');
      input.setAttribute('role', 'combobox'); input.setAttribute('aria-autocomplete', 'list');
      input.setAttribute('aria-controls', results.id); input.setAttribute('aria-expanded', 'false');
      input.parentElement.append(results, status);
      const close = () => { results.hidden = true; results.replaceChildren(); input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); active = -1; };
      const change = () => {
        clearTimeout(timer); const sequence = ++generation; close();
        if (input.value.trim().length < 4) return;
        timer = setTimeout(async () => {
          try {
            const data = await workforceApi('/application/address/suggest', { input: input.value, sessionToken: token });
            if (sequence !== generation || !input.isConnected) return;
            results.replaceChildren();
            for (const [index, item] of data.items.entries()) {
              const button = document.createElement('button'); button.type = 'button'; button.textContent = item.label;
              button.id = 'address-suggestion-' + index; button.setAttribute('role', 'option');
              button.onclick = async event => {
                event.preventDefault();
                try {
                  const detail = await workforceApi('/application/address/details', { placeId: item.id, sessionToken: token });
                  if (sequence !== generation || !input.isConnected) return;
                  onSelect(detail.address); token = crypto.randomUUID(); close();
                  status.textContent = 'Address filled. Confirm city, state and ZIP, and add an apartment or unit if needed.';
                } catch { status.textContent = 'Please enter the complete address manually.'; }
              };
              results.append(button);
            }
            if (data.items.length) {
              const attribution = document.createElement('span'); attribution.className = 'maps-attribution';
              attribution.setAttribute('translate', 'no'); attribution.textContent = data.provider === 'Google Maps' ? 'Google Maps' : 'Preview example — not a live Google result';
              results.append(attribution); results.hidden = false; input.setAttribute('aria-expanded', 'true');
            }
          } catch { if (sequence === generation) status.textContent = 'Address suggestions are unavailable. You can still type the full address.'; }
        }, 500);
      };
      const key = event => {
        const options = [...results.querySelectorAll('[role=option]')];
        if (event.key === 'Escape') { close(); return; }
        if (!options.length) return;
        if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
          event.preventDefault(); active = (active + (event.key === 'ArrowDown' ? 1 : options.length - 1) + options.length) % options.length;
          options.forEach((option, i) => option.setAttribute('aria-selected', String(i === active)));
          input.setAttribute('aria-activedescendant', options[active].id);
        }
        if (event.key === 'Enter' && active >= 0) { event.preventDefault(); options[active].click(); }
      };
      input.addEventListener('input', change); input.addEventListener('keydown', key);
      return () => { generation++; clearTimeout(timer); input.removeEventListener('input', change); input.removeEventListener('keydown', key); results.remove(); status.remove(); };
    }
  };
})();
