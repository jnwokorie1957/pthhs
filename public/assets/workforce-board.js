(() => {
 const el=id=>document.getElementById(id),text=(tag,value)=>{const n=document.createElement(tag);n.textContent=value;return n;};
 let generation=0,items=[],api,apply,dialog=null,applicationsEnabled=true;
 const schedule=value=>({weekdays:'Weekdays',weekends:'Weekends',flexible:'Flexible schedule'})[value]||value;
 function clear(){generation++;items=[];el('job-list').replaceChildren();dialog?.close();dialog?.remove();dialog=null;el('job-board').hidden=true;}
 function details(position){
  dialog?.remove();const sequence=generation;dialog=document.createElement('dialog');dialog.className='job-detail';dialog.setAttribute('aria-labelledby','job-detail-title');
  const heading=text('h2','Personal care attendant');heading.id='job-detail-title';
  const close=text('button','Close');close.type='button';close.className='btn-secondary';close.onclick=()=>dialog.close();
  const submit=text('button','Apply for this position');submit.type='button';submit.className='btn-primary';submit.hidden=!applicationsEnabled;
  const status=text('p','');status.setAttribute('role','status');
  submit.onclick=async()=>{submit.disabled=true;try{await api('/opportunities/'+encodeURIComponent(position.id)+'/interest',{});if(sequence!==generation)return;dialog.close();apply(position);}catch(error){if(sequence===generation)status.textContent=error.message;}finally{submit.disabled=false;}};
  const list=document.createElement('ul');for(const need of position.assistance)list.append(text('li',need.replaceAll('_',' ')));
  dialog.append(text('p',position.location),heading,text('p',position.weeklyHours+' hours per week · '+schedule(position.schedule)),text('h3','How you’ll help'),list,text('p','Support everyday activities in the home according to the authorized service plan. Duties and scheduling are confirmed with the office.'),text('p','An application or expression of interest does not guarantee employment or an assignment.'),submit,close,status);
  document.body.append(dialog);dialog.showModal();
 }
 function render(){
  const values=Object.fromEntries(new FormData(el('job-filters'))),filtered=items.filter(item=>WorkforceContract.matches(item,values));
  const list=el('job-list');list.replaceChildren();el('job-count').textContent=filtered.length+' '+(filtered.length===1?'opportunity':'opportunities');
  if(!filtered.length){const card=document.createElement('article');card.className='job-empty';card.append(text('h3',items.length?'No matches yet':'No openings listed right now'),text('p',items.length?'Try another area, schedule or number of hours.':'You can still complete a general application so the office can review your information.'));list.append(card);return;}
  for(const position of filtered){
   const card=document.createElement('article');card.className='job-card';
   const meta=document.createElement('div');meta.className='job-meta';meta.append(text('span',position.weeklyHours+' hours / week'),text('span',schedule(position.schedule)));
   const button=text('button','View position');button.type='button';button.className='btn-secondary';button.onclick=()=>details(position);
   card.append(text('p',position.location),text('h3','Personal care attendant'),meta,text('p',position.recruitingZip?'Work area '+position.recruitingZip:'Greater Houston service area'),button);list.append(card);
  }
 }
 el('job-filters').addEventListener('input',render);el('job-filters').addEventListener('submit',event=>{event.preventDefault();render();});
 el('job-filters-clear').onclick=()=>{el('job-filters').reset();render();};el('job-general-application').onclick=()=>apply?.();
 window.WorkforceBoard={clear,async open(actor,request,startApplication){
  clear();api=request;apply=startApplication;applicationsEnabled=actor.applicationsEnabled!==false;el('job-general-application').hidden=!applicationsEnabled;const sequence=generation;el('job-board').hidden=false;el('caregiver-summary').hidden=true;el('portal-release-notice').hidden=true;
  el('job-count').textContent='Loading opportunities…';el('job-message').textContent='';
  const preview=WorkforceContract.reviewNavigationAllowed(location.hostname,actor.previewNavigation);el('job-preview-note').hidden=!preview;
  try{const result=await api('/opportunities');if(sequence!==generation)return;if(!Array.isArray(result.items))throw Error('Please try again.');items=result.items;render();
   if(result.release==='pending')el('job-message').textContent='The office is preparing verified openings. General applications are available below.';
   const selected=WorkforceContract.selectedId(location.search),position=items.find(item=>item.id===selected);if(position)details(position);else if(selected)el('job-message').textContent='That position is no longer listed. Browse the current opportunities below.';
  }catch(error){if(sequence===generation){el('job-count').textContent='';el('job-message').textContent='Unable to load openings. '+error.message;const retry=text('button','Try again');retry.type='button';retry.onclick=()=>window.WorkforceBoard.open(actor,request,startApplication);el('job-list').append(retry);}}
 }};
})();
