(() => {
  let active = null;
  const sensitive = path => /^\/application\/(documents\/[a-zA-Z0-9_-]+|forms\/(i9|w4|new_hire|cch)\/pdf)$/.test(path)
    || /^\/staff\/applications\/[a-zA-Z0-9_-]+\/(pdf|packet\/pdf|forms\/(i9|w4|new_hire|cch)\/pdf|documents\/[a-zA-Z0-9_-]+(\/print)?)$/.test(path);
  const node = (tag, text) => { const element = document.createElement(tag); element.textContent = text; return element; };

  window.WorkforceDocumentAccess = {
    sensitive,
    async authorize(api, path) {
      if (active) throw Error('Finish or close the current verification request.');
      const dialog = document.createElement('dialog');
      dialog.className = 'job-detail';
      dialog.setAttribute('aria-labelledby', 'secure-document-heading');
      const heading = node('h2', 'Verify document access'); heading.id = 'secure-document-heading';
      const message = node('p', 'Requesting an email verification code…'); message.setAttribute('role', 'status');
      const form = document.createElement('form'), label = node('label', 'Six-digit code'); label.className = 'application-label';
      const input = document.createElement('input'); input.inputMode = 'numeric'; input.autocomplete = 'one-time-code';
      input.pattern = '[0-9]{6}'; input.maxLength = 6; input.required = true; input.disabled = true; label.append(input);
      const verify = node('button', 'Verify & open'); verify.type = 'submit'; verify.className = 'btn-primary'; verify.disabled = true;
      const close = node('button', 'Cancel'); close.type = 'button'; close.className = 'btn-secondary';
      form.append(label, verify, close); dialog.append(heading, message, form); document.body.append(dialog);
      active = dialog; dialog.showModal();
      return new Promise((resolve, reject) => {
        const finish = (error, token) => {
          if (active !== dialog) return;
          active = null; input.value = ''; dialog.close(); dialog.remove();
          document.removeEventListener('workforce-session-cleared', cancelled);
          error ? reject(error) : resolve(token);
        };
        const cancelled = () => finish(Error('Document verification closed.'));
        close.onclick = cancelled;
        dialog.addEventListener('cancel', event => { event.preventDefault(); cancelled(); });
        document.addEventListener('workforce-session-cleared', cancelled);
        api('/document-access/request', {path}).then(challenge => {
          if (active !== dialog) return;
          message.textContent = 'Check ' + challenge.maskedEmail + ' for your code. It expires in five minutes.';
          input.disabled = false; verify.disabled = false; input.focus();
          form.onsubmit = async event => {
            event.preventDefault(); if (verify.disabled || !form.reportValidity()) return;
            verify.disabled = true;
            try {
              const result = await api('/document-access/verify', {challengeId: challenge.challengeId, code: input.value});
              finish(null, result.accessToken);
            } catch (error) {
              if (active === dialog) { message.textContent = error.message; input.value = ''; verify.disabled = false; input.focus(); }
            }
          };
        }).catch(error => { if (active === dialog) message.textContent = error.message; });
      });
    }
  };
})();
