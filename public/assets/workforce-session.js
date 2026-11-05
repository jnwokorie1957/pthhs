(() => {
  const form = document.getElementById('workforce-login');
  const status = document.getElementById('session-status');
  const signout = document.getElementById('workforce-signout');
  if (!form) return;
  const staff = location.pathname.startsWith('/primetime/');
  const prefix = staff ? '/primetime/workforce-api' : '/caregiver/workforce-api';
  let auth, generation = 0, pendingLink = '', busy = false;
  const errors = {
    invalid_opportunity: 'Check the recruiting area, hours, ZIP and at least one broad assistance need.',
    revision_conflict: 'This record changed. Refresh and reopen its latest revision.',
    independent_privacy_review_required: 'A different authorized staff member must review the public details and confirm the privacy attestation.',
    privacy_review_stale: 'The public details need a new privacy review.',
    invalid_transition: 'This action is unavailable for the current status. Refresh the list.',
    workforce_forbidden: 'Your current permissions do not allow this action in this office.',
    staff_access_required: 'Individual staff access has not been granted to this account.',
    staff_access_revoked: 'Staff access has been revoked.',
    invalid_staff_grant: 'Check the role, offices and explicit permissions.',
    invalid_staff_target: 'Use another verified staff member’s Firebase UID.',
    owner_grant_requires_offline_review: 'Owner access requires a separate administrative review.',
    staff_identity_unverified: 'The staff account must be enabled with a verified email.',
    verified_identity_required: 'Sign in again using your verified email.',
    workforce_release_pending: 'This workforce service is awaiting release verification.'
    ,application_collection_pending: 'Online applications are awaiting release verification.'
    ,document_collection_pending: 'Private document uploads are awaiting security and retention verification.'
    ,recent_sign_in_required: 'Please sign in again before accessing sensitive records. Saved progress is kept securely.'
    ,employee_reactivation_review: 'You already have an employment account. Contact HR for file updates or reactivation; another full application is not required.'
    ,application_incomplete: 'Complete the required application fields before submitting.'
    ,invalid_answers: 'Check the dates, email, Social Security number format and field lengths.'
    ,signature_required: 'Read the release, choose electronic signing and type your name as entered on the application.'
    ,document_image_required: 'Choose a JPEG or PNG photograph.'
    ,unreadable_document_image: 'This image could not be processed. Choose a clear JPEG or PNG photograph.'
    ,invalid_document_size: 'Choose a JPEG or PNG no larger than 8 MB.'
    ,document_upload_unconfirmed: 'The upload could not be confirmed. Check its status before trying again.'
    ,upload_limit_reached: 'The upload attempt limit has been reached. Please try again later.'
    ,save_application_first: 'Save your application before uploading documents.'
  };
  const message = s => { status.textContent = s; };
  const hide = () => {
    document.getElementById('staff-workspace')?.setAttribute('hidden', '');
    document.getElementById('caregiver-summary')?.setAttribute('hidden', '');
  };
  async function api(path, body, download = false) {
    if (!auth?.currentUser) throw Error('Sign in required.');
    const token = await auth.currentUser.getIdToken();
    const r = await fetch(prefix + path, {
      method: body ? 'POST' : 'GET', cache: 'no-store',
      headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    if (r.ok && download) return r.blob();
    const result = await r.json();
    if (!r.ok) throw Error(errors[result.error] || 'The request could not be completed. Retry or contact the office.');
    return result;
  }
  window.workforceApi = api;
  async function session(user) {
    const sequence = ++generation;
    hide(); signout.hidden = !user;
    document.dispatchEvent(new CustomEvent('workforce-session-cleared'));
    if (!user) { form.hidden = false; message('Enter your email to receive a secure sign-in link.'); return; }
    form.hidden = true; message('Verifying account access…');
    try {
      const actor = await api(staff ? '/session' : '/application/session');
      if (sequence !== generation) return;
      message('Signed in. Permissions are verified for this session.');
      if (staff) document.dispatchEvent(new CustomEvent('workforce-session', { detail: actor }));
      else document.dispatchEvent(new CustomEvent('workforce-caregiver-session', { detail: actor }));
    } catch (error) {
      if (sequence === generation) { message('Access unavailable: ' + error.message + '. Contact the office or reload to retry.'); hide(); }
    }
  }
  async function start() {
    try {
      const r = await fetch(prefix + '/configuration', { cache: 'no-store' });
      if (!r.ok) throw Error();
      const config = await r.json();
      if (!(staff ? config.staffEnabled : config.accountsEnabled)) {
        message(staff ? 'Staff access is awaiting release verification.' : 'Online account registration and applications are not open yet. Please call the office about applying.'); return;
      }
      auth = firebase.auth();
      await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
      if (auth.isSignInWithEmailLink(location.href)) {
        pendingLink = location.href;
        history.replaceState(null, '', staff ? '/primetime/workforce' : WorkforceContract.returnPath(location.search));
        document.getElementById('workforce-login-button').textContent = 'Finish sign in';
      }
      auth.onAuthStateChanged(user => {
        if (pendingLink) { form.hidden = false; message('Confirm the email that received this link.'); }
        else session(user);
      });
    } catch { message('Secure sign-in is unavailable. Please retry later.'); }
  }
  form.addEventListener('submit', async e => {
    e.preventDefault(); if (busy || !auth) return;
    busy = true;
    const button = document.getElementById('workforce-login-button'); button.disabled = true;
    try {
      const email = document.getElementById('workforce-email').value.trim();
      if (pendingLink) {
        const result = await auth.signInWithEmailLink(email, pendingLink);
        pendingLink = ''; await session(result.user);
      } else {
        await auth.sendSignInLinkToEmail(email, {
          url: location.origin + (staff ? '/primetime/workforce' : WorkforceContract.returnPath(location.search)), handleCodeInApp: true
        });
        message('Check your email for a sign-in link.');
      }
    } catch { message('Unable to complete sign-in. Check the email or request a fresh link by reloading this page.'); }
    finally { busy = false; button.disabled = false; }
  });
  signout.addEventListener('click', async () => {
    ++generation; hide(); document.dispatchEvent(new CustomEvent('workforce-session-cleared'));
    try { await auth.signOut(); } catch { message('Sign-out could not be confirmed. Close this browser session.'); }
  });
  start();
})();
