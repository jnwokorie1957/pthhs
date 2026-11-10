
window.WorkforceManagementAuth = ({form, auth, session, message, api}) => {
  const get = id => document.getElementById(id);
  const password = get('staff-password');
  const identifier = get('workforce-email');
  const nextPassword = get('staff-new-password');
  const confirmation = get('staff-confirm-password');
  const username = get('staff-new-username');
  let mode = 'password', emailLink = '', linkForSetup = false, activationCode = '', setupEmail = '', busy = false;
  let verifiedEmail = '';

  function clearPasswords() {
    for (const input of [password, nextPassword, confirmation]) input.value = '';
    password.type = 'password';
    get('staff-show-password').textContent = 'Show password';
    get('staff-show-password').setAttribute('aria-pressed', 'false');
  }
  function show(next) {
    mode = next;
    const choosing = mode === 'choose';
    const confirming = mode === 'confirm';
    const passwordMode = mode === 'password';
    get('staff-password-row').hidden = !passwordMode;
    get('staff-new-credentials').hidden = !choosing;
    get('staff-back-to-signin').hidden = mode !== 'reset';
    get('staff-first-time').hidden = !passwordMode;
    identifier.type = passwordMode ? 'text' : 'email';
    identifier.required = !choosing;
    identifier.readOnly = choosing;
    if (choosing) identifier.value = setupEmail;
    if (mode === 'reset' && !identifier.value.includes('@')) identifier.value = verifiedEmail;
    get('staff-identifier-label').textContent = passwordMode ? 'Username or work email' : choosing ? 'Verified work email' : 'Work email';
    identifier.placeholder = passwordMode ? 'Username or work email' : 'you@work.com';
    password.required = passwordMode;
    nextPassword.required = confirmation.required = choosing;
    get('manager-login-description').textContent = {
      password:'Sign in with your username or work email and password.',
      reset:'Enter your work email to receive a secure password setup link.',
      confirm:'Confirm the work email that received your link.',
      choose:'Your work email is verified. Choose and confirm your password to continue.'
    }[mode];
    get('workforce-login-button').textContent = {
      password:'Sign in', reset:'Send password reset link', confirm:'Continue', choose:'Save password and sign in'
    }[mode];
    if (confirming && !linkForSetup) get('workforce-login-button').textContent = 'Finish sign in';
    clearPasswords();
  }
  function setBusy(value) {
    busy = value;
    for (const id of ['workforce-login-button','staff-forgot-password','staff-back-to-signin']) {
      get(id).disabled = value;
    }
  }
  const change = next => {
    if (busy) return;
    show(next);
    message('');
  };
  get('staff-forgot-password').onclick = () => change('reset');
  get('staff-back-to-signin').onclick = () => change('password');
  get('staff-show-password').onclick = () => {
    const showPassword = password.type === 'password';
    password.type = showPassword ? 'text' : 'password';
    get('staff-show-password').textContent = showPassword ? 'Hide password' : 'Show password';
    get('staff-show-password').setAttribute('aria-pressed', String(showPassword));
  };
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !auth()) return;
    setBusy(true);
    const login = identifier.value.trim();
    try {
      if (mode === 'reset') {
        await api('/staff-auth/password-setup', {email:login});
        message('If this email has an active staff account, check your inbox for the password setup link.');
      } else if (mode === 'confirm') {
        const result = await auth().signInWithEmailLink(login, emailLink);
        const choose = linkForSetup;
        const invite = activationCode;
        emailLink = '';
        linkForSetup = false;
        activationCode = '';
        show('password');
        await session(result.user, choose, invite);
      } else if (mode === 'choose') {
        const secret = nextPassword.value;
        if (secret.length < 8 || !/[A-Z]/.test(secret) || !/[a-z]/.test(secret)
          || !/[0-9]/.test(secret) || !/[^A-Za-z0-9\s]/.test(secret)) {
          message('Use at least 8 characters with uppercase, lowercase, a number, and a special character.');
          return;
        }
        if (secret !== confirmation.value) {
          message('The passwords must match.');
          return;
        }
        await api('/staff-auth/credentials', {password:secret, username:username.value.trim()});
        const result = await auth().signInWithEmailAndPassword(setupEmail, secret);
        username.value = '';
        show('password');
        await session(result.user);
      } else if (mode === 'password') {
        const secret = password.value;
        clearPasswords();
        const email = login.includes('@') ? login : (await api('/staff-auth/resolve-username', {username:login,password:secret})).email;
        await auth().signInWithEmailAndPassword(email, secret);
      }
    } catch (error) {
      clearPasswords();
      if (mode === 'confirm') {
        emailLink = '';
        linkForSetup = false;
        activationCode = '';
        show('password');
        message('This link is invalid or expired. Ask the sender for a new invitation, or use Forgot password? if your account is already set up.');
      } else if (mode === 'reset' || mode === 'choose') {
        message(error.code?.startsWith('staff_') || ['weak_staff_password','invalid_staff_username'].includes(error.code)
          ? error.message : 'Could not complete password setup. Request a fresh link and try again.');
      } else if (error.code === 'auth/too-many-requests' || error.code === 'staff_auth_rate_limit') {
        message('Too many attempts. Please wait before trying again.');
      } else {
        message('Unable to sign in. Check your username or work email and password.');
      }
    } finally {
      setBusy(false);
    }
  });
  document.addEventListener('workforce-session-cleared', () => {
    clearPasswords();
    if (!emailLink) {
      username.value = '';
      setupEmail = '';
      show('password');
    }
  });
  show('password');
  return {
    link(url, setup = false, invite = '') {
      emailLink = url;
      linkForSetup = setup;
      activationCode = invite;
      show('confirm');
    },
    setup(email) {
      verifiedEmail = email;
      setupEmail = email;
      show('choose');
      form.hidden = false;
      nextPassword.focus();
    },
    pending: () => !!emailLink || mode === 'choose',
  };
};
