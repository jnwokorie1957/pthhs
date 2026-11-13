// This restriction never opens collection: the existing release gates still apply.
export function caregiverWindow(previewUntil: string, launchAt: string, now = Date.now()) {
  if (!previewUntil && !launchAt) return {configured: false, open: true};
  const until = Date.parse(previewUntil), launch = Date.parse(launchAt);
  const valid = Number.isFinite(until) && Number.isFinite(launch) && until < launch;
  return {configured: true, open: valid && (now < until || now >= launch)};
}
