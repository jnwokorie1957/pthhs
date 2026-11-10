(() => {
  const form = document.getElementById('workforce-login');
  const status = document.getElementById('session-status');
  const signout = document.getElementById('workforce-signout');
  if (!form) return;
  const staff = ['/workforce', '/workforce/'].includes(location.pathname) || location.pathname.startsWith('/primetime/');
  const prefix = staff ? '/primetime/workforce-api' : '/caregiver/workforce-api';
  let auth, generation = 0, staffAuth;
  const errors = {
    opportunity_unavailable: 'This position is no longer available. Please browse the current openings.',
    invalid_opportunity: 'Check the recruiting area, hours, ZIP and at least one broad assistance need.',
    caregiver_document_download_failed_application_http_400_vendor_negative_310_reason_file_unavailable: 'HHA has this document record, but no file is attached.',
    hha_document_not_attached: 'HHA has this document record, but no file is attached.',
    caregiver_account_unavailable: 'This caregiver profile is unavailable to your account.',
    print_packet_too_large: 'Packet too large. Print each file separately.',
    invalid_caregiver_name: 'Enter a first or last name.',
    provider_managed_password: 'This account uses an external sign-in provider or is unavailable for password reset.',
    account_reset_limit: 'A reset was requested recently. Please wait before sending another email.',
    revision_conflict: 'This record changed. Refresh and reopen its latest revision.',
    independent_privacy_review_required: 'A different authorized staff member must review the public details and confirm the privacy attestation.',
    privacy_review_stale: 'The public details need a new privacy review.',
    invalid_transition: 'This action is unavailable for the current status. Refresh the list.',
    workforce_forbidden: 'Your current permissions do not allow this action in this office.',
    staff_access_required: 'Individual staff access has not been granted to this account.',
    staff_invite_unavailable: 'No active invitation matches this work email. Ask the owner to send a new invitation.',
    staff_invite_link_required: 'Open the original invitation from your work email to set up your account.',
    staff_training_required: 'Complete staff training to open the workspace.',
    staff_training_incomplete: 'Training progress is still being recorded. Try continuing in a moment.',
    staff_password_setup_required: 'Set your staff password before continuing.',
    staff_username_taken: 'That username is already in use. Choose another or leave it blank.',
    invalid_staff_username: 'Use 3 to 32 letters, numbers, periods, hyphens, or underscores. Start with a letter or number.',
    weak_staff_password: 'Use at least 8 characters with uppercase, lowercase, a number, and a special character.',
    staff_auth_rate_limit: 'Too many requests. Please wait before trying again.',
    staff_auth_unavailable: 'Staff email is temporarily unavailable. Please try again.',
    staff_already_registered: 'This account already has staff access on file. Use Manage existing access to change it.',
    invalid_staff_email: 'Enter a valid work email address.',
    staff_access_revoked: 'Staff access has been revoked.',
    invalid_staff_grant: 'Check the role, offices and explicit permissions.',
    invalid_staff_target: 'Use another verified staff member’s Firebase UID.',
    owner_grant_requires_offline_review: 'Owner access requires a separate administrative review.',
    staff_identity_unverified: 'The staff account must be enabled with a verified email.',
    verified_identity_required: 'Sign in again using your verified email.',
    existing_access_pending: 'Existing caregiver access is being prepared.',
    hha_email_review_required: 'Your HHA email or account link needs office review.',
    hha_profile_unavailable: 'Your HHA profile is unavailable. Please try again or contact the office.',
    workforce_release_pending: 'This workforce service is awaiting release verification.'
    ,application_collection_pending: 'Online applications are awaiting release verification.'
    ,document_collection_pending: 'Private document uploads are awaiting security and retention verification.'
    ,recent_sign_in_required: 'Please sign in again before accessing sensitive records. Saved progress is kept securely.'
    ,existing_caregiver_on_file: 'Your existing caregiver profile is on file. A new application or identity upload is not required.'
    ,employee_reactivation_review: 'You already have an employment account. Contact the office for file updates or reactivation; another full application is not required.'
    ,application_incomplete: 'Complete the required application fields before submitting.'
    ,invalid_answers: 'Check the dates, email, Social Security number format and field lengths.'
    ,signature_required: 'Read the release, choose electronic signing and type your name as entered on the application.'
    ,document_image_required: 'Choose a JPEG or PNG photograph.'
    ,unreadable_document_image: 'This image could not be processed. Choose a clear JPEG or PNG photograph.'
    ,invalid_document_size: 'Choose a JPEG or PNG no larger than 8 MB.'
    ,document_upload_unconfirmed: 'The upload could not be confirmed. Check its status before trying again.'
    ,upload_limit_reached: 'The upload attempt limit has been reached. Please try again later.'
    ,save_application_first: 'Save your application before uploading documents.'
    ,cch_signature_required: 'Sign and submit the DPS CCH Verification Form under Tax & employment forms.'
    ,required_documents_missing: 'Upload the required ID and Social Security card, or contact the office about an approved alternative arrangement.'
    ,invalid_pdf: 'Choose a complete PDF file, or upload a clear JPEG or PNG.'
    ,address_lookup_unavailable: 'Address suggestions are unavailable. You can still type your complete address.'
    ,address_lookup_limit: 'Please type your address manually or try suggestions again later.'
    ,form_revision_conflict: 'This form changed. Reopen the latest saved form before continuing.'
    ,form_already_submitted: 'This signed form is already submitted. Contact the office to request a correction.'
    ,invalid_form_fields: 'Check the form fields and allowed choices. Use standard letters and numbers.'
    ,form_incomplete: 'Complete the required personal information and select exactly one filing or citizenship status. Check any conditional fields in the official instructions.'
    ,i9_offer_required: 'Your I-9 draft can be saved here. Signing opens after the office records your accepted job offer.'
    ,form_not_found: 'Save a form draft before downloading it.'
  };
  const message = s => { status.textContent = s; };
  const hide = () => {
    document.getElementById('staff-workspace')?.setAttribute('hidden', '');
    document.getElementById('caregiver-summary')?.setAttribute('hidden', '');
  };
  async function api(path, body, download = false) {
    const guest=['/existing-caregiver/access','/staff-auth/password-setup','/staff-auth/resolve-username'].includes(path);
    if (!auth?.currentUser&&!guest) throw Error('Sign in required.');
    const token = guest ? '' : await auth.currentUser.getIdToken();
    const r = await fetch(prefix + path, {
      method: body ? 'POST' : 'GET', cache: 'no-store',
      headers: { ...(token ? {Authorization: 'Bearer '+token} : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    if (r.ok && download) return r.blob();
    const result = await r.json();
    if (!r.ok) throw Object.assign(Error(errors[result.error] || 'The request could not be completed. Retry or contact the office.'), {code: result.error});
    return result;
  }
  window.workforceApi = api;
  async function session(user, choosePassword = false, activationCode = '') {
    const sequence = ++generation;
    hide(); signout.hidden = !user;
    document.dispatchEvent(new CustomEvent('workforce-session-cleared'));
    if (!user) { form.hidden = false; message('Sign in with your username or work email and password.'); return; }
    form.hidden = true; message('Verifying account access…');
    try {
      const actor = await api(staff ? '/session' : '/application/session').catch(error => {
        if (!staff || sequence !== generation || error.code !== 'staff_access_required') throw error;
        return api('/staff/invitations/accept', activationCode ? {activationCode} : {});
      });
      if (sequence !== generation) return;
      if (staff && (choosePassword || actor.passwordSetupRequired)) {
        message('');
        staffAuth.setup(user.email);
        return;
      }
      if (staff && actor.trainingRequired) {
        message('');
        window.WorkforceTraining.require(() => {
          if (sequence === generation) session(user);
        });
        return;
      }
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
        const params = new URLSearchParams(location.search);
        let continuation;
        try { continuation = new URL(params.get('continueUrl')); } catch { /* Direct action URL. */ }
        const state = continuation?.origin === location.origin && continuation.pathname === '/workforce'
          ? continuation.searchParams : params;
        staffAuth.link(location.href, state.get('staffSetup') === '1', state.get('staffInvite') || '');
      }
      auth.onAuthStateChanged(user => {
        if (staffAuth.pending()) { form.hidden = false; message('Confirm the email that received this link.'); }
        else session(user);
      });
    } catch { message('Secure sign-in is unavailable. Please retry later.'); }
  }
  if (!staff) { window.WorkforceAccount.start({createAuth:()=>{auth=firebase.auth();return auth;},api}); return; }
  window.WorkforceSendPasswordReset=email=>auth.sendPasswordResetEmail(email,{url:location.origin+'/caregiver'});
  window.WorkforceSendStaffInvitation = ({email, activationCode}) => {
    const url = new URL('/workforce', location.origin);
    url.searchParams.set('staffSetup', '1');
    url.searchParams.set('staffInvite', activationCode);
    return auth.sendSignInLinkToEmail(email, {url:url.href,handleCodeInApp:true});
  };
  staffAuth=window.WorkforceManagementAuth({form,auth:()=>auth,session,message,api});
  signout.addEventListener('click', async () => {
    ++generation; hide(); document.dispatchEvent(new CustomEvent('workforce-session-cleared'));
    try { await auth.signOut(); } catch { message('Sign-out could not be confirmed. Close this browser session.'); }
  });
  start();
})();
