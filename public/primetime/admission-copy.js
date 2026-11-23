(()=>{
 const token=location.hash.slice(1),form=document.querySelector('form'),code=form.querySelector('input'),submit=form.querySelector('button'),status=document.querySelector('[role=status]'),link=document.querySelector('a');
 history.replaceState(null,'',location.pathname);
 if(!/^[A-Za-z0-9_-]{43}$/.test(token)){form.hidden=true;status.textContent='Open the complete link from the message the office sent you.';return;}
 let url;
 form.onsubmit=async e=>{
  e.preventDefault();if(submit.disabled||!form.reportValidity())return;
  submit.disabled=true;status.textContent='Preparing your signed packet…';
  try{
   const response=await fetch('/primetime/workforce-api/admission-copy',{method:'POST',credentials:'omit',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,code:code.value})});
   if(!response.ok){status.textContent=response.status===403?'Check the code. If the link expired or was locked, ask the office for a new one.':'The packet could not be opened. Try again or contact the office.';return;}
   if(!response.headers.get('content-type')?.includes('application/pdf'))throw Error();
   url=URL.createObjectURL(await response.blob());link.href=url;link.hidden=false;form.hidden=true;code.value='';status.textContent='Your signed documents are ready.';link.focus();
  }catch{status.textContent='Could not retrieve your packet. Check your connection and try again.';}
  finally{submit.disabled=false;}
 };
 window.addEventListener('pagehide',()=>{if(url)URL.revokeObjectURL(url);});
})();
