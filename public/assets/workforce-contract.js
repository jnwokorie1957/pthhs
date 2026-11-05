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
  root.WorkforceContract = Object.freeze({ validId, selectedId, returnPath, matches, reviewNavigationAllowed });
})(globalThis);
