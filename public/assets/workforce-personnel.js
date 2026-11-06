(() => {
  const panel = document.getElementById('personnel-workspace');
  if (!panel) return;
  let generation = 0, actor;
  const status = document.getElementById('personnel-message'), list = document.getElementById('personnel-list'), detail = document.getElementById('personnel-detail');
  const node = (tag, text) => { const element = document.createElement(tag); element.textContent = text; return element; };
  document.addEventListener('workforce-session-cleared', () => { generation++; actor = null; panel.hidden = true; list.replaceChildren(); detail.replaceChildren(); });
  document.addEventListener('workforce-session', event => {
    generation++; actor = event.detail;
    panel.hidden = !(['hr', 'owner'].includes(actor.grant.role) && actor.grant.permissions.includes('applications.review'));
  });
  async function open(uid) {
    const sequence = generation; detail.replaceChildren();
    try {
      const response = await workforceApi('/staff/applications/' + encodeURIComponent(uid));
      if (sequence !== generation) return;
      const application = response.application;
      detail.append(node('h3', 'Application · ' + application.state), node('p', 'Office: ' + application.office + ' · Packet: ' + application.packetVersion));
      const dl = document.createElement('dl');
      for (const [key, value] of Object.entries(application.answers)) dl.append(node('dt', ({ssn:'Social Security number',birthDate:'Date of birth'}[key]||key.replace(/([a-z])([A-Z])/g,'$1 $2').replaceAll('_',' ').replace(/^./,letter=>letter.toUpperCase()))), node('dd', key === 'ssn' ? '•••-••-' + String(value).replace(/\D/g, '').slice(-4) : key === 'birthDate' ? 'Restricted identity information supplied' : value || 'Not entered'));
      detail.append(dl);
      if (application.signature) detail.append(node('p', 'Reference release signed by ' + application.signature.name + ' at ' + application.signature.signedAt + '. Source hash and answer-version evidence are retained.'));
      if (!actor.grant.permissions.includes('documents.review')) return;
      detail.append(node('h3','Official forms completed in the portal'));
      for (const kind of ['i9','w4','new_hire']) {
        const result = await workforceApi('/staff/applications/' + encodeURIComponent(uid) + '/forms/' + kind);
        if (sequence !== generation) return;
        const form = result.form; detail.append(node('p',kind.toUpperCase() + ': ' + (form ? form.state + ' · revision ' + form.revision : 'Not started')));
        if (!form) continue;
        const download = node('button','Download private ' + kind.toUpperCase()); download.type = 'button';
        download.onclick = async () => { try { const blob=await workforceApi('/staff/applications/'+encodeURIComponent(uid)+'/forms/'+kind+'/pdf',undefined,true);if(sequence!==generation)return;const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='private-'+kind+'.pdf';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000); } catch(error){if(sequence===generation)status.textContent=error.message;} };detail.append(download);
      }
      const docs = await workforceApi('/staff/applications/' + encodeURIComponent(uid) + '/documents');
      if (sequence !== generation) return;
      detail.append(node('h3', 'Private document folder'));
      for (const doc of docs.items) {
        const button = node('button', doc.kind.replaceAll('_', ' ') + ' · ' + doc.state.replaceAll('_', ' ')); button.type = 'button';
        button.disabled = doc.state !== 'pending_review';
        button.onclick = async () => {
          try {
            const blob = await workforceApi('/staff/applications/' + encodeURIComponent(uid) + '/documents/' + encodeURIComponent(doc.id), undefined, true);
            if (sequence !== generation) return;
            const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = 'private-personnel-document.jpg'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
          } catch (error) { if (sequence === generation) status.textContent = error.message; }
        };
        detail.append(button);
      }
    } catch (error) { if (sequence === generation) status.textContent = error.message; }
  }
  document.getElementById('personnel-refresh').onclick = async () => {
    const sequence = generation;
    try {
      const response = await workforceApi('/staff/applications'); if (sequence !== generation) return;
      list.replaceChildren();document.dispatchEvent(new CustomEvent('workforce-applications-updated',{detail:response.items}));status.textContent = response.items.length + (response.items.length===1?' application':' applications')+' in your assigned offices (up to 50 per office).';
      if(!response.items.length){const empty=node('div','No applications to review yet. New applications will appear here.');empty.className='manager-empty';list.append(empty);}
      for (const item of response.items) {
        const button = node('button', (item.displayName||'Application #'+item.uid.slice(-6).toUpperCase())+' · '+({draft:'Draft',submitted:'Submitted'}[item.state]||item.state) + (item.weeklyHours ? ' · ' + item.weeklyHours + ' hours requested' : '') + (item.hoursReviewRequired ? ' · 40 HOURS: OFFICE REVIEW REQUIRED' : ''));
        if (item.hoursReviewRequired) button.className = 'hours-review-notice';
        button.type = 'button'; button.onclick = () => open(item.uid); list.append(button);
      }
    } catch (error) { if (sequence === generation) status.textContent = error.message; }
  };
  const support=document.getElementById('caregiver-account-support'),accountDetail=document.getElementById('caregiver-account-detail'),accountMessage=document.getElementById('caregiver-account-message');
  let accountGeneration=0;
  document.addEventListener('workforce-session-cleared',()=>{accountGeneration++;support.hidden=true;accountDetail.replaceChildren();accountMessage.textContent='';document.getElementById('caregiver-account-email').value='';});
  document.addEventListener('workforce-session',event=>{support.hidden=!(['owner','hr'].includes(event.detail.grant.role)&&event.detail.grant.permissions.includes('accounts.support'));});
  document.getElementById('caregiver-account-search').onsubmit=async event=>{
    event.preventDefault();if(!event.currentTarget.reportValidity())return;const sequence=++accountGeneration;accountDetail.replaceChildren();accountMessage.textContent='Finding caregiver account…';
    try{
      const account=await workforceApi('/staff/accounts/lookup',{email:document.getElementById('caregiver-account-email').value.trim()});if(sequence!==accountGeneration)return;
      accountMessage.textContent='';const labels={'password':'Email and password','google.com':'Google','apple.com':'Apple','microsoft.com':'Microsoft','yahoo.com':'Yahoo'};
      accountDetail.append(node('h3',account.email),node('p','Sign-in: '+account.providers.map(p=>labels[p]||p).join(', ')),node('p','Email: '+(account.emailVerified?'Verified':'Not yet verified')+' · Account: '+(account.disabled?'Disabled':'Active')),node('p','Application: '+account.state.replaceAll('_',' ')+' · Office: '+account.office));
      if(account.disabled){accountDetail.append(node('p','This account is disabled.'));return;}
      if(!account.providers.includes('password')){accountDetail.append(node('p','Password recovery is managed by the sign-in provider. Ask the caregiver to use that provider’s account recovery.'));return;}
      const send=node('button','Send password reset email');send.type='button';send.className='btn-secondary';send.onclick=async()=>{
        send.disabled=true;try{const result=await workforceApi('/staff/accounts/'+encodeURIComponent(account.uid)+'/reset',{});if(sequence!==accountGeneration)return;await window.WorkforceSendPasswordReset(result.email);if(sequence===accountGeneration)accountMessage.textContent='Password reset email requested for '+account.email+'. Ask the caregiver to check their inbox and spam folder.';}catch(error){if(sequence===accountGeneration){accountMessage.textContent=error.message;send.disabled=false;}}
      };accountDetail.append(send,node('p','The caregiver chooses their own new password. Staff cannot view passwords or reset links.'));
    }catch(error){if(sequence===accountGeneration)accountMessage.textContent=error.message;}
  };
})();
