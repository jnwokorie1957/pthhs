/* Shared selection/filtering contract; no identity or sensitive data. */
((root) => {
  const validId = id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(id);
  const selectedId = search => {
    const id = new URLSearchParams(search).get('opportunity');
    return validId(id) ? id : null;
  };
  const returnPath = search => {
    const id = selectedId(search);
    return '/caregiver' + (id ? '?opportunity=' + encodeURIComponent(id) : '');
  };
  const matches = (o, f) => (!f.zip || o.recruitingZip === f.zip)
    && (!f.location || o.location.toLowerCase().includes(f.location.toLowerCase()))
    && (!f.schedule || o.schedule === f.schedule)
    && (!f.hours || o.weeklyHours >= Number(f.hours))
    && (!f.type || o.type === f.type);
  const reviewNavigationAllowed = (hostname, serverFlag) => serverFlag === true && ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
  const formatPhone = value => {
    const digits = String(value).replace(/\D/g, ''), country = digits.length === 11 && digits[0] === '1', number = country ? digits.slice(1) : digits;
    if (!digits) return ''; if (number.length > 10) return value;
    return (country ? '+1 ' : '') + '(' + number.slice(0,3) + (number.length >= 3 ? ')' : '') + (number.length > 3 ? ' ' + number.slice(3,6) : '') + (number.length > 6 ? '-' + number.slice(6) : '');
  };
  const formatPhoneInput = input => {
    const caret = input.selectionStart, before = input.value, count = before.slice(0,caret ?? before.length).replace(/\D/g,'').length;
    input.value = formatPhone(before);
    if (typeof caret === 'number') { let position=0, seen=0; while(position<input.value.length && seen<count) { if(/\d/.test(input.value[position]))seen++; position++; } input.setSelectionRange(position,position); }
  };
  root.WorkforceContract = Object.freeze({ validId, selectedId, returnPath, matches, reviewNavigationAllowed, formatPhone, formatPhoneInput });
})(globalThis);
