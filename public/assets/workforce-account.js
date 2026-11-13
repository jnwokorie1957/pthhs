(() => {
  const byId = id => document.getElementById(id);
  const providerLogos={"google.com":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAOdEVYdFNvZnR3YXJlAEZpZ21hnrGWYwAABF1JREFUeAHtmX9sU1UUx7/3vf5km6vLNsYG22Rkwx8hNcMIrKsozBjBhf0BwRAjxh//ilGT+afKHxMRExWNJAYNwWiiBlimSIyZZGqMnVaJIq4DWhgbjLHSdrSlffd67tsqIYPwXsvSkuybnPdeXs5tP+/ce885fWUgdXZ21qeFtpsu3WQu5FkMbJ/KlBe6urpOsim439tWt7m8nlY4HA7kU4lEAr/2+3Cg+0DYwtR71eUty3e3r213P7TyQVgsFuRbkqGutlZeOgLHA25FAOuWLm1GoanV45EntyKPTocThaYpJpeCAtcsYK6aBcxVuSW+iRjEoW+BP/8ABgPA2REqAwyonAssagJWeMBWr0IuyhpQ9PYAH74PEY4DHDoYk3BSo2NgF/yA7xjweTewcR2waiWyUVaA4ss3gP1fAEkbLRIrmLh6pTBmpYOdHKkMnAkC27fRQ1wG2h6GWZkH/P5VsP69EMWUSDUC01QITpEjFiYkHd0TGgFNkKXpmqzhDpruFchG5gCDe4HQe0CFQ19qQqNptd1GkdkEdj+VpoZFk36Dg8C+r4BDB+leA7BtB1BUjGxkDnD4NdoAtObsHEIV4GV1UDfsBBY0Xu0noV58map8B1BVlTWcOcCxPeQd1LtFYRdIWB2wPfAORbPx+mMyEc1BxgGjtGsttL6o/+F01qofh1pxJ2ZaxgETf+s7VgJqzAZ7zfprunXsTOu7l0mT65QOGm0cIftkuqcIjme8KtYsMVYjjAOmTiFTeBh9oWqvuaZbMHLlI2VWFNM8VBw9B6yBMRkHlDkNk6awTE65wRDkLuO12FpN+S4FTqbxBHjyBExr6hmL7caHGI4gt9+FVHwASYpkjEyc/xg1Jd5pfr+9Mn3ss58K9Icmr2U5XDwXhmU4gqmiVoxzDSOc4yTV3p/PfYLTkcM3HHc6oqFveAJpNQmuaBRAgcaZALSWP4kRxYUTNEUBAhzgFnzw7/M4mxi67phQLIH2ngHEnKO4ZIsgaYnDXZ9GdSkMyzCgorpQVrsDIaq7QaHiFHfir/hFPPbLerx09F0ciQb/9w3GL2DrsZ9w33c9+Cc9hJh9HBO2i5TcI3jOw2BGpkpdbflmLIgdgX9oF86LYoyLUkRFCfYM/4iPzvTrXRfVQHBtDrRUOTRRBWGTyVDR98fTS0qxbL656mq6o36k/i0sm7cFYV6CKC/GJUEw9Jw840DphykpinicLEZpL4q0NYYNi4uwtaUSZpVVy//EwtexpfFN3O5YiMvCBk5RY8hMnawg1G4pSQKNk08a25ubsKulCdko64760aq1un02fBjdo35agyGEEmP6Lq1zluHuogZ4Su/BpvnNcFlNJL6bBZjRxnle3WZKsz87c9UsYK66JQDD8UQchaYMkwT09/X1odDk8/nkab/qbfX+MHA8sHmOw+moqKyA1WJFPiUj19vbi68PfiNfonfo9Um+6deE9rZ8X438K0xV02+B+pT8G+I/GQh/7Ve+elUAAAAASUVORK5CYII=","apple.com":"data:image/svg+xml,%3Csvg%20role%3D%22img%22%20viewBox%3D%220%200%2024%2024%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Ctitle%3EApple%3C/title%3E%3Cpath%20d%3D%22M12.152%206.896c-.948%200-2.415-1.078-3.96-1.04-2.04.027-3.91%201.183-4.961%203.014-2.117%203.675-.546%209.103%201.519%2012.09%201.013%201.454%202.208%203.09%203.792%203.039%201.52-.065%202.09-.987%203.935-.987%201.831%200%202.35.987%203.96.948%201.637-.026%202.676-1.48%203.676-2.948%201.156-1.688%201.636-3.325%201.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04%202.48-4.494%202.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675%201.09-4.61%201.09zM15.53%203.83c.843-1.012%201.4-2.427%201.245-3.83-1.207.052-2.662.805-3.532%201.818-.78.896-1.454%202.338-1.273%203.714%201.338.104%202.715-.688%203.559-1.701%22/%3E%3C/svg%3E","microsoft.com":"data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2024%2024%22%3E%3Cpath%20fill%3D%22%23f25022%22%20d%3D%22M1%201h10v10H1z%22/%3E%3Cpath%20fill%3D%22%237fba00%22%20d%3D%22M13%201h10v10H13z%22/%3E%3Cpath%20fill%3D%22%2300a4ef%22%20d%3D%22M1%2013h10v10H1z%22/%3E%3Cpath%20fill%3D%22%23ffb900%22%20d%3D%22M13%2013h10v10H13z%22/%3E%3C/svg%3E","yahoo.com":"data:image/svg+xml,%3Csvg%20fill%3D%22%236001d2%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20512%20512%22%3E%3Cpath%20d%3D%22M223.69%2C141.06%2C167%2C284.23%2C111%2C141.06H14.93L120.76%2C390.19%2C82.19%2C480h94.17L317.27%2C141.06Zm105.4%2C135.79a58.22%2C58.22%2C0%2C1%2C0%2C58.22%2C58.22A58.22%2C58.22%2C0%2C0%2C0%2C329.09%2C276.85ZM394.65%2C32l-93%2C223.47H406.44L499.07%2C32Z%22/%3E%3C/svg%3E"};
  window.WorkforceAccount = { async start({createAuth,api}) {
    const gateway=byId('account-gateway'),form=byId('workforce-login'),status=byId('session-status'),dashboard=byId('caregiver-dashboard');
    let auth,mode='signin',busy=false,generation=0,actor=null,resetCode='',providerOnly=false,existingEnabled=false,existingReady=true,accountsEnabled=false;
    const message=value=>status.textContent=value;
    const clearHha=()=>window.WorkforceHha?.clear();
    const passwords=()=>{for(const id of ['workforce-password','workforce-password-confirm'])byId(id).value='';};
    const initialMode=()=>new URLSearchParams(location.search).get('intent')==='register'?'create':new URLSearchParams(location.search).get('intent')==='reset'?'reset':new URLSearchParams(location.search).get('intent')==='existing'?'existing':'signin';
    function isolate(){++generation;clearHha();window.WorkforceBoard.clear();byId('job-board').hidden=true;byId('caregiver-summary').hidden=true;dashboard.hidden=true;byId('workforce-signout').hidden=true;byId('portal-release-notice').hidden=true;document.dispatchEvent(new CustomEvent('workforce-session-cleared'));}
    function screen(next){if(next==='existing'&&!existingEnabled)next='signin';
      isolate();byId('account-tabs').hidden=!['signin','create'].includes(next);byId('account-back').hidden=['signin','create'].includes(next);byId('account-back').textContent=actor?'Back to my portal':'Back to sign in';byId('account-forgot').hidden=next!=='signin';byId('account-help').hidden=providerOnly||['reset','existing','newpassword'].includes(next);byId('account-existing').hidden=next!=='signin'||!existingEnabled;byId('account-providers').hidden=!['signin','create'].includes(next);
      mode=next; passwords(); gateway.hidden=false; byId('account-verification').hidden=true;form.hidden=providerOnly&&next!=='newpassword';
      const newPassword=next==='newpassword',confirmation=next==='create'||newPassword;
      byId('account-title').textContent=next==='create'?'Create your account':next==='existing'?'Existing caregiver access':next==='reset'?'Reset your password':newPassword?'Choose a new password':'Sign in';
      byId('account-description').textContent=next==='create'?'One account for your caregiver application.':next==='existing'?'Use the email recorded in your HHAeXchange profile. We will send a link to set your Primetime portal password.':next==='reset'?'Enter your account email to receive a password reset link.':newPassword?'Enter and confirm your new password.':'Enter your email and password to continue.';
      byId('account-names').hidden=next!=='create';for(const id of ['account-first-name','account-last-name'])byId(id).required=next==='create';
      byId('email-row').hidden=newPassword;byId('workforce-email').required=!newPassword;
      if(providerOnly&&['signin','create'].includes(next))byId('account-description').textContent='Sign in with Google to continue.';
      byId('password-row').hidden=['reset','existing'].includes(next);byId('confirm-password-row').hidden=!confirmation;
      const input=byId('workforce-password');input.required=!['reset','existing'].includes(next);input.minLength=confirmation?12:1;input.autocomplete=confirmation?'new-password':'current-password';input.type='password';
      byId('workforce-password-confirm').required=confirmation;byId('password-hint').hidden=!confirmation;
      byId('workforce-login-button').disabled=!accountsEnabled||next==='existing'&&!existingReady;if(next==='existing'&&!existingReady)byId('account-description').textContent='Existing caregiver profiles are being prepared. Please check back shortly.';
      byId('workforce-login-button').textContent=next==='create'?'Create account':next==='existing'?'Send portal access link':next==='reset'?'Send reset link':newPassword?'Update password':'Sign in';
      for(const id of ['account-signin','account-create'])byId(id).setAttribute('aria-current',id===('account-'+(next==='create'?'create':'signin'))?'page':'false');
      byId('password-show').textContent='Show password';byId('password-show').setAttribute('aria-pressed','false');
      byId('workforce-email').readOnly=next==='reset'&&!!actor;
      document.title=byId('account-title').textContent+' | Primetime Caregiver Portal';byId('account-title').focus({preventScroll:true});
    }
    function clear(){clearHha();byId('account-retry').hidden=true;actor=null;dashboard.hidden=true;byId('job-board').hidden=true;byId('caregiver-summary').hidden=true;window.WorkforceBoard.clear();document.dispatchEvent(new CustomEvent('workforce-session-cleared'));byId('portal-release-notice').hidden=true;}
    async function session(user){
      const sequence=++generation;clear();byId('workforce-signout').hidden=!user;
      if(!user){screen(initialMode());message('');return;}
      gateway.hidden=false;form.hidden=true;byId('account-verification').hidden=true;
      byId('account-tabs').hidden=true;byId('account-back').hidden=true;
      if(!user.emailVerified){byId('account-title').textContent='Check your email';byId('account-description').textContent='Verify your email to continue.';byId('account-verification').hidden=false;message('Open the verification link in your email, then return here.');return;}
      message('Opening your caregiver account…');
      try{
        await user.getIdToken(true);const detail=await api('/application/session');if(sequence!==generation)return;
        actor=detail;byId("dashboard-hha").hidden=!detail.existingCaregiver;byId('dashboard-application').hidden=detail.applicationsEnabled===false||detail.existingCaregiver===true;document.title='My portal | Primetime Caregiver Portal';byId('dashboard-password').textContent=user.providerData?.length&&!user.providerData.some(p=>p.providerId==='password')?'Sign-in help':'Reset password';gateway.hidden=true;dashboard.hidden=false;message('');window.WorkforceNavigation.mount({actor:detail,api,application:openApplication,jobs:()=>window.WorkforceBoard.open(detail,api,openApplication)});

      }catch(error){if(sequence===generation){message(error.message);form.hidden=true;byId('account-retry').hidden=false;}}
    }
    function openApplication(position, navigation={}){
      if(!actor||actor.applicationsEnabled===false||actor.existingCaregiver===true)return;clearHha();
      byId('job-board').hidden=true;byId('caregiver-summary').hidden=false;
      if(position){const url=new URL(location.href);url.searchParams.set('opportunity',position.id);history.replaceState(null,'',url.pathname+url.search+url.hash);}
      window.WorkforceNavigation.applicationOpened();
      document.dispatchEvent(new CustomEvent('workforce-caregiver-session',{detail:{...actor,selectedOpportunity:position||null,navigation}}));
      byId('caregiver-summary').scrollIntoView({block:'start'});
    }
    const failure=error=>error.code==='auth/too-many-requests'?'Too many attempts. Please wait before trying again.':error.code==='auth/network-request-failed'?'Unable to connect. Check your connection and try again.':error.code==='auth/operation-not-allowed'?'Account access is not open yet. Please contact the office.':mode==='create'?'Unable to create the account. Check your entries, or try signing in or resetting your password.':'Unable to sign in. Check your email and password, or use Forgot password.';
    async function reset(email){try{await auth.sendPasswordResetEmail(email,{url:location.origin+'/caregiver'});}catch(error){if(!['auth/user-not-found','auth/invalid-email'].includes(error.code))throw error;}message('If an account uses this email, a password reset link has been sent. Check your inbox and spam folder.');}
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(busy||!auth||mode==='existing'&&!existingReady||!form.reportValidity())return;
      busy=true;byId('workforce-login-button').disabled=true;byId('account-retry').hidden=true;
      try{
        const email=byId('workforce-email').value.trim();
        if(mode==='reset'){await reset(email);return;}
        const password=byId('workforce-password').value;
        if(mode==='existing'){await api('/existing-caregiver/access',{email});message('If your email matches a caregiver profile, a portal password link has been requested. Check your inbox and spam folder.');return;}
        if(mode==='newpassword'){
          if(password!==byId('workforce-password-confirm').value){message('The passwords do not match.');return;}
          await auth.confirmPasswordReset(resetCode,password);resetCode='';await auth.signOut();screen('signin');message('Your password has been updated. Sign in with your new password.');return;
        }
        if(mode==='create'){
          if(password!==byId('workforce-password-confirm').value){message('The passwords do not match.');return;}
          if(!byId("account-first-name").value.trim()||!byId("account-last-name").value.trim()){message("Enter your first and last name.");return;}
          const result=await auth.createUserWithEmailAndPassword(email,password);passwords();await result.user.updateProfile({displayName:[byId("account-first-name").value.trim(),byId("account-last-name").value.trim()].join(" ")});
          try{await result.user.sendEmailVerification({url:location.origin+'/caregiver'});}catch{message('Your account was created, but the verification email could not be sent. Select Resend verification email to try again.');}
        }else{await auth.signInWithEmailAndPassword(email,password);passwords();}
      }catch(error){message(mode==='newpassword'?'Unable to update the password. The link may have expired. Request a new reset link.':failure(error));passwords();}
      finally{busy=false;byId('workforce-login-button').disabled=false;}
    });
    byId('account-signin').onclick=()=>{screen('signin');message('');};byId('account-create').onclick=()=>{screen('create');message('');};
    byId('account-existing').onclick=()=>{screen('existing');message('');};
    byId('account-forgot').onclick=()=>{screen('reset');message('');};
    byId('account-back').onclick=async()=>{message('');if(actor){gateway.hidden=true;dashboard.hidden=false;byId('workforce-signout').hidden=false;window.WorkforceNavigation.mount({actor,api,application:openApplication,jobs:()=>window.WorkforceBoard.open(actor,api,openApplication)});}else screen('signin');};
    byId('password-show').onclick=()=>{const show=byId('workforce-password').type==='password';byId('workforce-password').type=show?'text':'password';byId('password-show').textContent=show?'Hide password':'Show password';byId('password-show').setAttribute('aria-pressed',String(show));};
    byId('verification-resend').onclick=async event=>{const button=event.currentTarget;button.disabled=true;try{await auth.currentUser.sendEmailVerification({url:location.origin+'/caregiver'});message('Verification email sent. Check your inbox and spam folder.');}catch{message('Unable to send the email. Please wait and try again.');}finally{setTimeout(()=>button.disabled=false,30000);}};
    byId('verification-check').onclick=async event=>{const button=event.currentTarget;button.disabled=true;try{await auth.currentUser.reload();await session(auth.currentUser);}catch{message('Unable to verify your account. Please try again.');}finally{button.disabled=false;}};
    byId('account-retry').onclick=()=>session(auth.currentUser);
    byId('portal-signout').onclick=()=>byId('workforce-signout').click();
    byId('workforce-signout').onclick=async()=>{++generation;clear();passwords();byId('workforce-email').value='';try{await auth.signOut();}catch{message('Sign-out could not be confirmed. Close this browser window.');}};
    byId('dashboard-application').onclick=async()=>{try{await window.WorkforceReview?.flush();openApplication();}catch(error){message(error.message);}};
    byId('dashboard-hha').onclick=async()=>{byId('job-board').hidden=true;byId('caregiver-summary').hidden=true;await window.WorkforceHha?.open(api);};
    byId('dashboard-jobs').onclick=async()=>{try{await window.WorkforceReview?.flush();document.dispatchEvent(new CustomEvent('workforce-session-cleared'));history.replaceState(null,'',location.pathname);if(actor)window.WorkforceNavigation.mount({actor,api,application:openApplication,jobs:()=>window.WorkforceBoard.open(actor,api,openApplication)});}catch(error){message(error.message);}};
    byId('dashboard-password').onclick=async()=>{if(!auth?.currentUser)return;try{await window.WorkforceReview?.flush();if(!auth.currentUser)return;screen('reset');byId('workforce-email').value=auth.currentUser.email;message('');const methods=auth.currentUser.providerData;if(methods?.length&&!methods.some(p=>p.providerId==='password')){form.hidden=true;byId('account-title').textContent='Sign-in help';byId('account-description').textContent='Your password is managed by '+methods.map(p=>({'google.com':'Google','apple.com':'Apple','microsoft.com':'Microsoft','yahoo.com':'Yahoo'})[p.providerId]||p.providerId).join(', ')+'. Use that provider’s account recovery, then return here to sign in.';}}catch{message('Unable to open password reset. Please try again.');}};
    try{
      const response=await fetch('/caregiver/workforce-api/configuration',{cache:'no-store'});if(!response.ok)throw Error();const config=await response.json();
      const closePreview=()=>{++generation;clear();accountsEnabled=false;gateway.hidden=false;form.hidden=true;byId('account-tabs').hidden=true;byId('account-title').textContent='Caregiver portal opens January 1, 2027';byId('account-description').textContent='The temporary preview has ended. Please call 713-977-7721 for help before launch.';};
      if(config.portalClosed){closePreview();return;}
      const remaining=Date.parse(config.portalPreviewEndsAt)-Date.now();if(remaining>0&&remaining<=43200000)setTimeout(closePreview,remaining);
      accountsEnabled=config.accountsEnabled===true;providerOnly=config.providerOnly===true;existingEnabled=config.existingAccessEnabled===true;existingReady=config.existingCaregiverEnrollmentReady!==false;screen(initialMode());
      const providers=Array.isArray(config.enabledSignInProviders)?config.enabledSignInProviders:[];
      for(const [id,label] of [['google.com','Google'],['apple.com','Apple'],['microsoft.com','Microsoft'],['yahoo.com','Yahoo']]){
        if(!providers.includes(id))continue;
        const button=document.createElement('button');button.type='button';button.className='provider-button provider-button-'+id.split('.')[0];button.setAttribute('aria-label','Sign in with '+label);button.title='Sign in with '+label;const logo=document.createElement('img');logo.src=providerLogos[id];logo.alt='';logo.width=id==='google.com'?40:24;logo.height=logo.width;logo.setAttribute('aria-hidden','true');button.append(logo);button.disabled=!config.accountsEnabled;
        button.onclick=async()=>{if(busy||!auth)return;busy=true;button.disabled=true;message('');try{const provider=id==='google.com'?new firebase.auth.GoogleAuthProvider():new firebase.auth.OAuthProvider(id);if(id==='google.com')provider.setCustomParameters({prompt:'select_account'});if(id==='apple.com')provider.addScope('email');await auth.signInWithPopup(provider);}catch(error){message(error.code==='auth/popup-closed-by-user'?'Sign-in cancelled.':error.code==='auth/account-exists-with-different-credential'?'An account already uses this email. Sign in using its existing method.':error.code==='auth/popup-blocked'?'Allow the sign-in window in your browser, then try again.':'Unable to sign in with '+label+'. Try another sign-in method.');}finally{busy=false;button.disabled=false;}};
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
