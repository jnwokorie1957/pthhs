(()=>{
 let generation=0,pending=null;
 document.addEventListener('workforce-session-cleared',()=>{generation++;pending?.cancel();});
 window.WorkforceReauthenticate={confirm(){
  if(pending)return pending.promise;
  const user=window.firebase?.auth?.().currentUser,token=generation;if(!user?.email)return Promise.reject(Error('Sign in again to view this document.'));
  const dialog=document.createElement('dialog');dialog.className='workforce-modal staff-password-confirmation';dialog.setAttribute('aria-labelledby','document-password-heading');
  const form=document.createElement('form'),heading=document.createElement('h2'),text=document.createElement('p'),label=document.createElement('label'),password=document.createElement('input'),status=document.createElement('p'),confirm=document.createElement('button'),cancel=document.createElement('button');
  heading.id='document-password-heading';heading.textContent='Confirm your identity';text.textContent='Enter your own staff-portal password to view this private authorization.';label.textContent='Your password';password.type='password';password.autocomplete='current-password';password.required=true;password.maxLength=128;label.append(password);status.setAttribute('role','status');confirm.type='submit';confirm.textContent='Confirm and open';confirm.className='manager-primary';cancel.type='button';cancel.textContent='Cancel';cancel.className='btn-secondary';form.append(heading,text,label,status,confirm,cancel);dialog.append(form);
  let resolve,reject,ended=false;const promise=new Promise((a,b)=>{resolve=a;reject=b;});
  const finish=(error)=>{if(ended)return;ended=true;password.value='';if(dialog.open)dialog.close();dialog.remove();if(pending?.promise===promise)pending=null;error?reject(error):resolve();};
  const stop=()=>finish(Error('Document viewing cancelled.'));pending={promise,cancel:stop};cancel.onclick=stop;dialog.oncancel=event=>{event.preventDefault();stop();};
  form.onsubmit=async event=>{event.preventDefault();if(confirm.disabled)return;confirm.disabled=true;const secret=password.value;password.value='';try{await user.reauthenticateWithCredential(window.firebase.auth.EmailAuthProvider.credential(user.email,secret));if(ended)return;await user.getIdToken(true);if(token!==generation||window.firebase.auth().currentUser?.uid!==user.uid)throw Error();finish();}catch{if(!ended&&token===generation&&pending?.promise===promise){status.textContent='Could not confirm your password. Retry or use the portal password-reset option.';confirm.disabled=false;password.focus();}}};
  document.body.append(dialog);dialog.showModal();password.focus();return promise;
 }};
})();
