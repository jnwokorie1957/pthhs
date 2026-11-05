import assert from 'node:assert/strict';
for (const site of ['pthhs','rideprimetime']) {
  const response=await fetch('https://pthhs.net/primetime/api/website-analytics?site='+site+'&days=28',{signal:AbortSignal.timeout(15000),redirect:'error',cache:'no-store'});
  assert.equal(response.status,401,'Anonymous analytics must require owner sign-in');
  assert.match(response.headers.get('cache-control') || '',/private/);
  assert.match(response.headers.get('cache-control') || '',/no-store/);
  assert.match(response.headers.get('x-robots-tag') || '',/noindex/);
  assert.equal((await response.json()).error,'sign_in_required');
  const live=await fetch('https://pthhs.net/primetime/api/website-live-views?site='+site,{cache:'no-store'});
  assert.equal(live.status,401,'Daily live counts remain owner-only');
}
console.log('ANALYTICS_ANONYMOUS_BOUNDARY: PASS; populated owner reporting requires separate source acceptance.');
