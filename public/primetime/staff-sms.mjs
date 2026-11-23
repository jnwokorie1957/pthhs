let active=false;
export async function confirm(api,challenge,perform){
 if(active)throw Error('Finish the current text verification first.');
 active=true;
 const make=(tag,text)=>{const e=document.createElement(tag);e.textContent=text||'';return e;};
 const dialog=make('dialog'),form=make('form'),input=make('input'),status=make('p'),verify=make('button','Verify and continue'),cancel=make('button','Cancel');
 dialog.className='workforce-modal staff-sms';dialog.setAttribute('aria-labelledby','staff-code-heading');
 const title=make('h2','Verify with a text');title.id='staff-code-heading';
 status.setAttribute('role','status');input.autocomplete='one-time-code';input.inputMode='numeric';input.pattern='[0-9]{6}';input.maxLength=6;input.required=true;
 const label=make('label','Six-digit code');label.append(input);verify.className='manager-primary';verify.disabled=true;cancel.type='button';cancel.className='btn-secondary';
 form.append(label,verify,cancel);dialog.append(title,make('p','Confirm your identity to '+challenge.action+'.'),status,form);document.body.append(dialog);dialog.showModal();
 try{return await new Promise((resolve,reject)=>{
  let closed=false,id;
  const finish=(error,value)=>{if(closed)return;closed=true;document.removeEventListener('workforce-session-cleared',stop);error?reject(error):resolve(value);};
  const stop=()=>finish(Error('Verification cancelled.'));cancel.onclick=stop;dialog.oncancel=e=>{e.preventDefault();stop();};document.addEventListener('workforce-session-cleared',stop);
  status.textContent='Requesting your verification text…';
  api('/staff-sms/request',{binding:challenge.binding}).then(sent=>{
   if(closed)return;id=sent.id;status.textContent=sent.practiceMessage||('Enter the code sent to the phone ending in '+sent.lastFour+'. It expires in five minutes.');
   verify.disabled=false;input.focus();
  }).catch(e=>{if(!closed)status.textContent=e.message;});
  form.onsubmit=async e=>{e.preventDefault();if(!id||verify.disabled||!form.reportValidity())return;
   verify.disabled=true;cancel.disabled=true;
   try{finish(null,await perform(id+'.'+input.value));}catch(e){if(e.code==='invalid_staff_code'){status.textContent=e.message;input.value='';verify.disabled=false;cancel.disabled=false;input.focus();}else finish(e);}
  };
 });}finally{active=false;input.value='';dialog.close();dialog.remove();}
}
