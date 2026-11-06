(() => {
  const byId = id => document.getElementById(id);
  window.WorkforceAccount = { async start({createAuth,api}) {
    const gateway=byId('account-gateway'),form=byId('workforce-login'),status=byId('session-status'),dashboard=byId('caregiver-dashboard');
    let auth,mode='signin',busy=false,generation=0,actor=null;
    const message=value=>status.textContent=value;
    const passwords=()=>{for(const id of ['workforce-password','workforce-password-confirm'])byId(id).value='';};
    function screen(next){
      mode=next; passwords(); gateway.hidden=false; byId('account-verification').hidden=true;form.hidden=false;
      byId('account-title').textContent=next==='create'?'Create your caregiver account':next==='reset'?'Reset your password':'Welcome back';
      byId('account-description').textContent=next==='create'?'One account to find opportunities and complete your application.':next==='reset'?'Enter your account email. We’ll send a secure link to choose a new password.':'Sign in to browse openings or return to your application.';
      byId('password-row').hidden=next==='reset';byId('confirm-password-row').hidden=next!=='create';
      const input=byId('workforce-password');input.required=next!=='reset';input.minLength=next==='create'?12:1;input.autocomplete=next==='create'?'new-password':'current-password';input.type='password';
      byId('workforce-password-confirm').required=next==='create';byId('password-hint').hidden=next!=='create';
      byId('workforce-login-button').textContent=next==='create'?'Create account':next==='reset'?'Send reset link':'Sign in';
      for(const id of ['account-signin','account-create'])byId(id).setAttribute('aria-current',id===('account-'+(next==='create'?'create':'signin'))?'page':'false');
      byId('password-show').textContent='Show password';byId('password-show').setAttribute('aria-pressed','false');
      byId('account-title').focus();
    }
    function clear(){byId('account-retry').hidden=true;actor=null;dashboard.hidden=true;byId('job-board').hidden=true;byId('caregiver-summary').hidden=true;window.WorkforceBoard.clear();document.dispatchEvent(new CustomEvent('workforce-session-cleared'));byId('portal-release-notice').hidden=true;}
    async function session(user){
      const sequence=++generation;clear();byId('workforce-signout').hidden=!user;
      if(!user){screen(new URLSearchParams(location.search).get('intent')==='register'?'create':'signin');message('');return;}
      gateway.hidden=false;form.hidden=true;byId('account-verification').hidden=true;
      if(!user.emailVerified){byId('account-title').textContent='Check your email';byId('account-description').textContent='Verify your email before viewing openings or starting an application.';byId('account-verification').hidden=false;message('Open the verification link in your email, then return here.');return;}
      message('Opening your caregiver account…');
      try{
        await user.getIdToken(true);const detail=await api('/application/session');if(sequence!==generation)return;
        actor=detail;gateway.hidden=true;dashboard.hidden=false;message('');await window.WorkforceBoard.open(detail,api,openApplication);
        if(new URLSearchParams(location.search).get('intent')==='apply')openApplication();
      }catch(error){if(sequence===generation){message(error.message);form.hidden=true;byId('account-retry').hidden=false;}}
    }
    function openApplication(position){
      if(!actor)return;
      byId('job-board').hidden=true;byId('caregiver-summary').hidden=false;
      const url=new URL(location.href);url.search='';if(position)url.searchParams.set('opportunity',position.id);history.replaceState(null,'',url.pathname+url.search);
      document.dispatchEvent(new CustomEvent('workforce-caregiver-session',{detail:{...actor,selectedOpportunity:position||null}}));
      byId('caregiver-summary').scrollIntoView({block:'start'});
    }
    const failure=error=>error.code==='auth/too-many-requests'?'Too many attempts. Please wait before trying again.':error.code==='auth/network-request-failed'?'Unable to connect. Check your connection and try again.':error.code==='auth/operation-not-allowed'?'Account access is not open yet. Please contact the office.':mode==='create'?'Unable to create the account. Check your entries, or try signing in or resetting your password.':'Unable to sign in. Check your email and password, or use Forgot password.';
    async function reset(email){try{await auth.sendPasswordResetEmail(email,{url:location.origin+'/caregiver'});}catch(error){if(!['auth/user-not-found','auth/invalid-email'].includes(error.code))throw error;}message('If an account uses this email, a password reset link has been sent. Check your inbox and spam folder.');}
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(busy||!auth||!form.reportValidity())return;
      busy=true;byId('workforce-login-button').disabled=true;byId('account-retry').hidden=true;
      try{
        const email=byId('workforce-email').value.trim();
        if(mode==='reset'){await reset(email);return;}
        const password=byId('workforce-password').value;
        if(mode==='create'){
          if(password!==byId('workforce-password-confirm').value){message('The passwords do not match.');return;}
          const result=await auth.createUserWithEmailAndPassword(email,password);passwords();
          try{await result.user.sendEmailVerification({url:location.origin+'/caregiver'});}catch{message('Your account was created, but the verification email could not be sent. Select Resend verification email to try again.');}
        }else{await auth.signInWithEmailAndPassword(email,password);passwords();}
      }catch(error){message(failure(error));passwords();}
      finally{busy=false;byId('workforce-login-button').disabled=false;}
    });
    byId('account-signin').onclick=()=>{screen('signin');message('');};byId('account-create').onclick=()=>{screen('create');message('');};
    byId('account-forgot').onclick=()=>{screen('reset');message('');};
    byId('password-show').onclick=()=>{const show=byId('workforce-password').type==='password';byId('workforce-password').type=show?'text':'password';byId('password-show').textContent=show?'Hide password':'Show password';byId('password-show').setAttribute('aria-pressed',String(show));};
    byId('verification-resend').onclick=async event=>{const button=event.currentTarget;button.disabled=true;try{await auth.currentUser.sendEmailVerification({url:location.origin+'/caregiver'});message('Verification email sent. Check your inbox and spam folder.');}catch{message('Unable to send the email. Please wait and try again.');}finally{setTimeout(()=>button.disabled=false,30000);}};
    byId('verification-check').onclick=async event=>{const button=event.currentTarget;button.disabled=true;try{await auth.currentUser.reload();await session(auth.currentUser);}catch{message('Unable to verify your account. Please try again.');}finally{button.disabled=false;}};
    byId('account-retry').onclick=()=>session(auth.currentUser);
    byId('workforce-signout').onclick=async()=>{++generation;clear();passwords();byId('workforce-email').value='';try{await auth.signOut();}catch{message('Sign-out could not be confirmed. Close this browser window.');}};
    byId('dashboard-application').onclick=async()=>{try{await window.WorkforceReview?.flush();openApplication();}catch(error){message(error.message);}};
    byId('dashboard-jobs').onclick=async()=>{try{await window.WorkforceReview?.flush();document.dispatchEvent(new CustomEvent('workforce-session-cleared'));history.replaceState(null,'',location.pathname);if(actor)await window.WorkforceBoard.open(actor,api,openApplication);}catch(error){message(error.message);}};
    byId('dashboard-password').onclick=async()=>{if(!auth?.currentUser)return;try{await reset(auth.currentUser.email);}catch{message('Unable to send the reset link. Please try again later.');}};
    try{
      const response=await fetch('/caregiver/workforce-api/configuration',{cache:'no-store'});if(!response.ok)throw Error();const config=await response.json();
      screen(new URLSearchParams(location.search).get('intent')==='register'?'create':'signin');
      if(!config.accountsEnabled){byId('workforce-login-button').disabled=true;message('Online accounts are being prepared. Call 713-977-7721 about applying.');return;}
      auth=createAuth();await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);auth.onAuthStateChanged(session);
    }catch{message('Secure account access is unavailable. Please reload to try again.');}
  }};
})();
