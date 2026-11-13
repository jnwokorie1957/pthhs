(() => {
 window.WorkforceSignature={mount(target,{name,appearance={style:'cursive'},onChange=()=>{},readOnly=false}){
  let value=JSON.parse(JSON.stringify(appearance)),active=null;
  const box=document.createElement('section');box.className='signature-choice';
  const title=document.createElement('h3');title.textContent='Your electronic signature';box.append(title);
  const preview=document.createElement('p');preview.className='signature-cursive';preview.textContent=name;
  const canvas=document.createElement('canvas');canvas.width=650;canvas.height=130;canvas.className='signature-pad';canvas.setAttribute('aria-label','Draw your signature with a mouse, pen or finger');
  const context=canvas.getContext('2d');
  const repaint=()=>{context.clearRect(0,0,650,130);context.lineWidth=2;context.lineCap='round';context.lineJoin='round';context.strokeStyle='#152739';for(const stroke of value.strokes||[]){context.beginPath();stroke.forEach((p,i)=>context[i?'lineTo':'moveTo'](p[0]*650,p[1]*130));context.stroke();}};
  const actions=document.createElement('div');actions.className='workforce-actions';
  const buttons=[];for(const [style,label]of [['cursive','Typed signature'],['drawn','Hand-drawn signature']]){const button=document.createElement('button');button.type='button';button.className='btn-secondary';button.textContent=label;button.disabled=readOnly;button.onclick=()=>{value=style==='cursive'?{style}:{style,strokes:[]};update();onChange();};buttons.push([style,button]);actions.append(button);}
  const reset=document.createElement('button');reset.type='button';reset.className='account-text-button';reset.textContent='Clear drawing';reset.disabled=readOnly;reset.onclick=()=>{value={style:'drawn',strokes:[]};repaint();onChange();};
  const hint=document.createElement('p');hint.className='small-note';hint.textContent='Signing as '+name+'. Your signature is applied only when you confirm and submit.';
  const update=()=>{preview.hidden=value.style!=='cursive';canvas.hidden=reset.hidden=value.style!=='drawn';for(const[style,b]of buttons)b.setAttribute('aria-pressed',String(value.style===style));repaint();};
  const point=e=>{const r=canvas.getBoundingClientRect();return [Math.round(Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))*10000)/10000,Math.round(Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))*10000)/10000];};
  canvas.onpointerdown=e=>{if(readOnly||value.style!=='drawn'||value.strokes.length>=80||value.strokes.reduce((n,s)=>n+s.length,0)>=1598)return;e.preventDefault();canvas.setPointerCapture(e.pointerId);active=[point(e)];value.strokes.push(active);onChange();};
  canvas.onpointermove=e=>{if(!active||value.strokes.reduce((n,s)=>n+s.length,0)>=1600)return;active.push(point(e));repaint();};
  canvas.onpointerup=canvas.onpointercancel=()=>{if(active?.length===1)value.strokes.pop();active=null;repaint();onChange();};
  box.append(actions,preview,canvas,reset,hint);target.append(box);update();
  return {get:()=>{if(value.style==='drawn'&&!value.strokes.some(s=>s.length>=2))throw Error('Draw your signature or choose your name in cursive.');return JSON.parse(JSON.stringify(value));},snapshot:()=>JSON.parse(JSON.stringify(value))};
 }};
})();
// Reusable appearances are encrypted on this browser. Consent and document
// signatures are never reused: each document still requires review and submit.
(() => {
 const original=window.WorkforceSignature.mount,copy=v=>JSON.parse(JSON.stringify(v));let database;
 const db=()=>database??=new Promise((resolve,reject)=>{const r=indexedDB.open('workforce-signature-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('vault');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 async function store(id,value,remove=false){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('vault',value===undefined&&!remove?'readonly':'readwrite'),s=tx.objectStore('vault'),r=remove?s.delete(id):value===undefined?s.get(id):s.put(value,id);let result;r.onsuccess=()=>{result=r.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
 async function vault(scope){const id=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(scope))),b=>b.toString(16).padStart(2,'0')).join('');let key=await store('key:'+id);if(!key){key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);await store('key:'+id,key);}const aad=new TextEncoder().encode(id);return {async read(){const r=await store(id);return r?JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:r.iv,additionalData:aad},key,r.bytes))):null;},async save(value){const iv=crypto.getRandomValues(new Uint8Array(12)),bytes=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},key,new TextEncoder().encode(JSON.stringify(value)));await store(id,{iv,bytes});},forget:()=>store(id,undefined,true)};}
 window.WorkforceSignature.mount=function(target,options){
  if(options.readOnly)return original(target,options);
  const node=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;},button=(text,fn)=>{const b=node('button',text);b.type='button';b.className='btn-secondary';b.onclick=fn;return b;};
  const box=node('section');box.className='signature-reusable';const field=button('Tap to add your signature',()=>{if(savedReady&&!applied){apply.click();return;}picker.hidden=false;field.setAttribute('aria-expanded','true');});field.className='signature-field';field.setAttribute('aria-expanded','false');
  const picker=node('div');picker.className='signature-picker';picker.hidden=true;const mount=node('div'),feedback=node('p');feedback.setAttribute('role','status');feedback.className='small-note';let ui,applied=false,touched=false,savedVault=null,savedReady=false,operation=0;
  const invalidate=()=>{touched=true;savedReady=false;applied=false;field.replaceChildren(node('span','Tap to add your signature'));options.onChange?.();};
  const render=value=>{mount.replaceChildren();ui=original(mount,{...options,appearance:value,onChange:invalidate});};render(options.appearance||{style:'cursive'});
  const rememberLabel=node('label','Remember this signature on this browser'),remember=node('input');remember.type='checkbox';remember.checked=true;rememberLabel.className='signature-remember';rememberLabel.prepend(remember);
  const display=value=>{field.replaceChildren();if(value.style==='cursive'){const text=node('span',options.name);text.className='signature-cursive';field.append(text);}else{const canvas=node('canvas');canvas.width=650;canvas.height=130;canvas.className='signature-applied-drawing';canvas.setAttribute('aria-label','Applied handwritten signature');const c=canvas.getContext('2d');c.lineWidth=2;c.lineCap='round';for(const stroke of value.strokes){c.beginPath();stroke.forEach((p,i)=>c[i?'lineTo':'moveTo'](p[0]*650,p[1]*130));c.stroke();}field.append(canvas);}field.append(node('small','Signature applied · Tap to change'));};
  const apply=button('Use this signature',async()=>{try{if(!options.name?.trim())throw Error('Enter the signer’s full name first.');const value=ui.get(),seq=++operation;applied=true;savedReady=true;display(value);picker.hidden=true;field.setAttribute('aria-expanded','false');options.onChange?.();options.onApply?.(copy(value));if(savedVault){if(remember.checked)await savedVault.save({name:options.name,appearance:value});else await savedVault.forget();if(seq===operation)feedback.textContent=remember.checked?'Signature remembered on this browser.':'Signature applied for this visit.';}else feedback.textContent='Signature applied. Browser storage is unavailable; you may need to enter it next visit.';}catch(e){feedback.textContent=e.message;}});apply.className='btn-primary';
  const forget=button('Forget saved signature',async()=>{try{operation++;await savedVault?.forget();remember.checked=false;render({style:'cursive'});invalidate();feedback.textContent='Saved signature removed from this browser.';}catch{feedback.textContent='Could not remove the saved signature. Please try again.';}});
  picker.append(mount,rememberLabel,apply,forget);box.append(field,picker,feedback,node('p','Apply your signature to each field, then review and confirm each document.'));target.append(box);
  const uid=window.firebase?.auth?.().currentUser?.uid;
  if(uid&&options.name?.trim())vault(uid+'|'+(options.context||'self')+'|'+options.name.trim().toLowerCase()).then(async v=>{const saved=await v.read();if(!box.isConnected||window.firebase?.auth?.().currentUser?.uid!==uid)return;savedVault=v;if(saved&&!touched&&saved.name.trim().toLowerCase()===options.name.trim().toLowerCase()){render(saved.appearance);savedReady=true;feedback.textContent='Saved signature ready. Tap any signature field to apply it.';}}).catch(()=>{feedback.textContent='Signature can be used now, but cannot be remembered in this browser.';});
  return {get:()=>{if(!applied)throw Error('Tap the signature field and choose Use this signature first.');return ui.get();},snapshot:()=>ui.snapshot(),open:()=>field.click()};
 };
})();
