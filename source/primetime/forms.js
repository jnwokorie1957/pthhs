(() => {
  const panel = document.getElementById('formsWorkspace');
  if (!panel) return;
  const $ = id => document.getElementById(id);
  let generation = 0, busy = false, active = window.primetimeDataMode?.isActive?.() === true, nextCursor = null, downloadUrl = null;
  const available = () => active && window.primetimeDataMode?.isLive() === true;
  const message = text => { $('formsStatus').textContent = text; };
  const controls = ['formFile', 'formUploadKind', 'formUploadSubmit', 'formLibraryKind', 'formsReload', 'formsNext'];
  function updateControls() {
    for (const id of controls) $(id).disabled = !available() || busy || (id === 'formsNext' && !nextCursor);
    for (const button of $('formsRows').querySelectorAll('button')) button.disabled = !available() || busy;
  }
  function revoke() { if (downloadUrl) URL.revokeObjectURL(downloadUrl); downloadUrl = null; }
  function clear() {
    generation++; busy = false; nextCursor = null; revoke();
    $('formFile').value = ''; $('formsRows').replaceChildren();
    message(available() ? 'Private Firebase forms library ready. Choose Load files to browse.' : 'Sign in with Demo data off to use private forms.');
    updateControls();
  }
  function check(current) { if (current !== generation || !available()) throw new Error('session_changed'); }
  async function request(path, options, current) {
    check(current);
    const response = await window.primetimeApiFetch('/primetime/api/forms' + path, options);
    check(current);
    if (!response.ok) {
      const result = await response.json(); check(current);
      throw new Error(result.error || 'form_storage_unavailable');
    }
    return response;
  }
  const errors = {
    invalid_form_filename: 'Use a filename up to 120 characters, starting with a letter or number. Use letters, numbers, spaces, underscores, parentheses, periods or hyphens.',
    invalid_form_size_or_encoding: 'Choose a nonempty file no larger than 2 MiB.',
    unsupported_form_content: 'Choose a PDF, PNG or JPEG file.',
    form_extension_mismatch: 'The filename extension does not match the file content.',
    form_integrity_error: 'The saved file could not be verified. Download was blocked.',
    form_not_found: 'This file is no longer available. Reload the library.',
    operational_data_release_not_approved: 'Private forms are locked pending operational data release.'
  };
  async function action(task) {
    if (!available() || busy) return;
    const current = generation; busy = true; updateControls(); message('Working with private Firebase Storage…');
    try { await task(current); }
    catch (error) { if (current === generation) message(errors[error.message] || 'Storage request was not confirmed. Reload the library before retrying. Uploading identical content will reuse its saved file.'); }
    finally { if (current === generation) { busy = false; updateControls(); } }
  }
  function bytesLabel(size) { return `${size.toLocaleString()} bytes`; }
  async function download(item, current) {
    const response = await request(`/${item.kind}/${item.id}`, {}, current), bytes = await response.arrayBuffer();
    check(current);
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
    check(current);
    if (bytes.byteLength !== item.size || hash !== item.sha256 || response.headers.get('X-Content-SHA256') !== hash) throw new Error('form_integrity_error');
    revoke(); downloadUrl = URL.createObjectURL(new Blob([bytes], { type: item.contentType }));
    const link = document.createElement('a'); link.href = downloadUrl; link.download = item.filename;
    document.body.append(link); link.click(); link.remove();
    message(`Download verified: ${item.filename} (${bytesLabel(item.size)}). SHA-256 matches the saved file.`);
  }
  async function load(current, cursor = null) {
    nextCursor = null; $('formsRows').replaceChildren();
    const kind = $('formLibraryKind').value;
    const response = await request(`?kind=${encodeURIComponent(kind)}${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`, {}, current);
    const result = await response.json(); check(current);
    for (const item of result.items) {
      const row = document.createElement('tr');
      for (const text of [item.filename, bytesLabel(item.size), new Date(item.uploadedAt).toLocaleString()]) { const cell = document.createElement('td'); cell.textContent = text; row.append(cell); }
      const cell = document.createElement('td'), button = document.createElement('button');
      button.type = 'button'; button.className = 'btn secondary'; button.textContent = 'Download';
      button.setAttribute('aria-label', 'Download ' + item.filename);
      button.addEventListener('click', () => action(current => download(item, current)));
      cell.append(button); row.append(cell); $('formsRows').append(row);
    }
    nextCursor = result.nextCursor;
    return `${result.items.length} file${result.items.length === 1 ? '' : 's'} on this page${nextCursor ? '; more files available' : ''}.`;
  }
  $('formsReload').addEventListener('click', () => action(async current => message(await load(current))));
  $('formsNext').addEventListener('click', () => { const cursor = nextCursor; if (cursor) void action(async current => message(await load(current, cursor))); });
  $('formLibraryKind').addEventListener('change', () => { generation++; nextCursor = null; revoke(); $('formsRows').replaceChildren(); message('Folder changed. Choose Load files to browse.'); updateControls(); });
  $('formUpload').addEventListener('submit', event => {
    event.preventDefault();
    void action(async current => {
      const file = $('formFile').files[0];
      if (!file || file.size < 1 || file.size > 2097152) throw new Error('invalid_form_size_or_encoding');
      const kind = $('formUploadKind').value, bytes = new Uint8Array(await file.arrayBuffer()); check(current);
      let binary = ''; for (let offset = 0; offset < bytes.length; offset += 16384) binary += String.fromCharCode(...bytes.subarray(offset, offset + 16384));
      const response = await request('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, filename: file.name, base64: btoa(binary) }) }, current);
      const result = await response.json(); check(current); $('formFile').value = ''; $('formLibraryKind').value = kind;
      const count = await load(current);
      message(`${result.duplicate ? 'Already stored; identical content reused' : 'Upload saved to Firebase Storage'}: ${result.item.filename} (${bytesLabel(result.item.size)}). ${count}`);
    });
  });
  document.addEventListener('primetime-ready', () => { active = true; clear(); });
  document.addEventListener('primetime-signed-out', () => { active = false; clear(); });
  document.addEventListener('primetime-data-mode-changed', clear);
  clear();
})();
