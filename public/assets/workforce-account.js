(() => {
  const byId = id => document.getElementById(id);
  window.WorkforceAccount = { async start({createAuth,api}) {
    const gateway=byId('account-gateway'),form=byId('workforce-login'),status=byId('session-status'),dashboard=byId('caregiver-dashboard');
    let auth,mode='signin',busy=false,generation=0,actor=null,resetCode='';
    const message=value=>status.textContent=value;
    const passwords=()=>{for(const id of ['workforce-password','workforce-password-confirm'])byId(id).value='';};
    const initialMode=()=>new URLSearchParams(location.search).get('intent')==='register'?'create':new URLSearchParams(location.search).get('intent')==='reset'?'reset':'signin';
    function isolate(){++generation;window.WorkforceBoard.clear();byId('job-board').hidden=true;byId('caregiver-summary').hidden=true;dashboard.hidden=true;byId('workforce-signout').hidden=true;byId('portal-release-notice').hidden=true;document.dispatchEvent(new CustomEvent('workforce-session-cleared'));}
    function screen(next){
      isolate();byId('account-tabs').hidden=!['signin','create'].includes(next);byId('account-back').hidden=['signin','create'].includes(next);byId('account-back').textContent=actor?'Back to my portal':'Back to sign in';byId('account-forgot').hidden=next!=='signin';byId('account-help').hidden=['reset','newpassword'].includes(next);byId('account-providers').hidden=!['signin','create'].includes(next);
      mode=next; passwords(); gateway.hidden=false; byId('account-verification').hidden=true;form.hidden=false;
      const newPassword=next==='newpassword',confirmation=next==='create'||newPassword;
      byId('account-title').textContent=next==='create'?'Create your account':next==='reset'?'Reset your password':newPassword?'Choose a new password':'Sign in';
      byId('account-description').textContent=next==='create'?'One account for your caregiver application.':next==='reset'?'Enter your account email to receive a password reset link.':newPassword?'Enter and confirm your new password.':'Enter your email and password to continue.';
      byId('email-row').hidden=newPassword;byId('workforce-email').required=!newPassword;
      byId('password-row').hidden=next==='reset';byId('confirm-password-row').hidden=!confirmation;
      const input=byId('workforce-password');input.required=next!=='reset';input.minLength=confirmation?12:1;input.autocomplete=confirmation?'new-password':'current-password';input.type='password';
      byId('workforce-password-confirm').required=confirmation;byId('password-hint').hidden=!confirmation;
      byId('workforce-login-button').textContent=next==='create'?'Create account':next==='reset'?'Send reset link':newPassword?'Update password':'Sign in';
      for(const id of ['account-signin','account-create'])byId(id).setAttribute('aria-current',id===('account-'+(next==='create'?'create':'signin'))?'page':'false');
      byId('password-show').textContent='Show password';byId('password-show').setAttribute('aria-pressed','false');
      byId('workforce-email').readOnly=next==='reset'&&!!actor;
      document.title=byId('account-title').textContent+' | Primetime Caregiver Portal';byId('account-title').focus({preventScroll:true});
    }
    function clear(){byId('account-retry').hidden=true;actor=null;dashboard.hidden=true;byId('job-board').hidden=true;byId('caregiver-summary').hidden=true;window.WorkforceBoard.clear();document.dispatchEvent(new CustomEvent('workforce-session-cleared'));byId('portal-release-notice').hidden=true;}
    async function session(user){
      const sequence=++generation;clear();byId('workforce-signout').hidden=!user;
      if(!user){screen(initialMode());message('');return;}
      gateway.hidden=false;form.hidden=true;byId('account-verification').hidden=true;
      byId('account-tabs').hidden=true;byId('account-back').hidden=true;
      if(!user.emailVerified){byId('account-title').textContent='Check your email';byId('account-description').textContent='Verify your email to continue.';byId('account-verification').hidden=false;message('Open the verification link in your email, then return here.');return;}
      message('Opening your caregiver account…');
      try{
        await user.getIdToken(true);const detail=await api('/application/session');if(sequence!==generation)return;
        actor=detail;document.title='My portal | Primetime Caregiver Portal';byId('dashboard-password').textContent=user.providerData?.length&&!user.providerData.some(p=>p.providerId==='password')?'Sign-in help':'Reset password';gateway.hidden=true;dashboard.hidden=false;message('');await window.WorkforceBoard.open(detail,api,openApplication);
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
        if(mode==='newpassword'){
          if(password!==byId('workforce-password-confirm').value){message('The passwords do not match.');return;}
          await auth.confirmPasswordReset(resetCode,password);resetCode='';await auth.signOut();screen('signin');message('Your password has been updated. Sign in with your new password.');return;
        }
        if(mode==='create'){
          if(password!==byId('workforce-password-confirm').value){message('The passwords do not match.');return;}
          const result=await auth.createUserWithEmailAndPassword(email,password);passwords();
          try{await result.user.sendEmailVerification({url:location.origin+'/caregiver'});}catch{message('Your account was created, but the verification email could not be sent. Select Resend verification email to try again.');}
        }else{await auth.signInWithEmailAndPassword(email,password);passwords();}
      }catch(error){message(mode==='newpassword'?'Unable to update the password. The link may have expired. Request a new reset link.':failure(error));passwords();}
      finally{busy=false;byId('workforce-login-button').disabled=false;}
    });
    byId('account-signin').onclick=()=>{screen('signin');message('');};byId('account-create').onclick=()=>{screen('create');message('');};
    byId('account-forgot').onclick=()=>{screen('reset');message('');};
    byId('account-back').onclick=async()=>{message('');if(actor){gateway.hidden=true;dashboard.hidden=false;byId('workforce-signout').hidden=false;await window.WorkforceBoard.open(actor,api,openApplication);}else screen('signin');};
    byId('password-show').onclick=()=>{const show=byId('workforce-password').type==='password';byId('workforce-password').type=show?'text':'password';byId('password-show').textContent=show?'Hide password':'Show password';byId('password-show').setAttribute('aria-pressed',String(show));};
    byId('verification-resend').onclick=async event=>{const button=event.currentTarget;button.disabled=true;try{await auth.currentUser.sendEmailVerification({url:location.origin+'/caregiver'});message('Verification email sent. Check your inbox and spam folder.');}catch{message('Unable to send the email. Please wait and try again.');}finally{setTimeout(()=>button.disabled=false,30000);}};
    byId('verification-check').onclick=async event=>{const button=event.currentTarget;button.disabled=true;try{await auth.currentUser.reload();await session(auth.currentUser);}catch{message('Unable to verify your account. Please try again.');}finally{button.disabled=false;}};
    byId('account-retry').onclick=()=>session(auth.currentUser);
    byId('workforce-signout').onclick=async()=>{++generation;clear();passwords();byId('workforce-email').value='';try{await auth.signOut();}catch{message('Sign-out could not be confirmed. Close this browser window.');}};
    byId('dashboard-application').onclick=async()=>{try{await window.WorkforceReview?.flush();openApplication();}catch(error){message(error.message);}};
    byId('dashboard-jobs').onclick=async()=>{try{await window.WorkforceReview?.flush();document.dispatchEvent(new CustomEvent('workforce-session-cleared'));history.replaceState(null,'',location.pathname);if(actor)await window.WorkforceBoard.open(actor,api,openApplication);}catch(error){message(error.message);}};
    byId('dashboard-password').onclick=async()=>{if(!auth?.currentUser)return;try{await window.WorkforceReview?.flush();if(!auth.currentUser)return;screen('reset');byId('workforce-email').value=auth.currentUser.email;message('');const methods=auth.currentUser.providerData;if(methods?.length&&!methods.some(p=>p.providerId==='password')){form.hidden=true;byId('account-title').textContent='Sign-in help';byId('account-description').textContent='Your password is managed by '+methods.map(p=>({'google.com':'Google','apple.com':'Apple','microsoft.com':'Microsoft','yahoo.com':'Yahoo'})[p.providerId]||p.providerId).join(', ')+'. Use that provider’s account recovery, then return here to sign in.';}}catch{message('Unable to open password reset. Please try again.');}};
    try{
      const response=await fetch('/caregiver/workforce-api/configuration',{cache:'no-store'});if(!response.ok)throw Error();const config=await response.json();
      screen(initialMode());
      const providers=Array.isArray(config.enabledSignInProviders)?config.enabledSignInProviders:[];
      for(const [id,label] of [['google.com','Google'],['apple.com','Apple'],['microsoft.com','Microsoft'],['yahoo.com','Yahoo']]){
        if(!providers.includes(id))continue;
        const button=document.createElement('button');button.type='button';button.className='provider-button';button.textContent='Continue with '+label;button.disabled=!config.accountsEnabled;
        button.onclick=async()=>{if(busy||!auth)return;busy=true;button.disabled=true;message('');try{const provider=id==='google.com'?new firebase.auth.GoogleAuthProvider():new firebase.auth.OAuthProvider(id);if(id==='apple.com')provider.addScope('email');await auth.signInWithPopup(provider);}catch(error){message(error.code==='auth/popup-closed-by-user'?'Sign-in cancelled.':error.code==='auth/account-exists-with-different-credential'?'An account already uses this email. Sign in using its existing method.':error.code==='auth/popup-blocked'?'Allow the sign-in window in your browser, then try again.':'Unable to sign in with '+label+'. Try another sign-in method.');}finally{busy=false;button.disabled=false;}};
        byId('account-providers').append(button);
      }
      const action=new URLSearchParams(location.search),actionMode=action.get('mode'),code=action.get('oobCode');
      if(actionMode){
        message('');
        mode='action';
        auth=createAuth();await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);history.replaceState(null,'',location.pathname);
        byId('account-tabs').hidden=true;form.hidden=true;byId('account-back').hidden=false;
        try{
          if(actionMode==='resetPassword'&&code){await auth.verifyPasswordResetCode(code);resetCode=code;screen('newpassword');}
          else if(actionMode==='verifyEmail'&&code){await auth.applyActionCode(code);screen('signin');message('Your email is verified. Sign in to continue.');}
          else throw Error();
        }catch{byId('account-title').textContent='Link unavailable';byId('account-description').textContent='This link is invalid or has expired. Return to sign in to request a new email.';}
        auth.onAuthStateChanged(user=>{if(!['action','newpassword'].includes(mode))session(user);});
        return;
      }
      if(!config.accountsEnabled){byId('workforce-login-button').disabled=true;message('Online accounts are being prepared. Call 713-977-7721 about applying.');return;}
      auth=createAuth();await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);auth.onAuthStateChanged(session);
    }catch{message('Secure account access is unavailable. Please reload to try again.');}
  }};
})();
