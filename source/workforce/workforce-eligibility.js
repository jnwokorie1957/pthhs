(() => {
  const panel=document.getElementById('eligibility-panel'); if(!panel)return;
  let actor=null,generation=0,request=0,next=null,ready=false,rows=[],reviewers=[];
  const pendingKeys=new Map();
  const make=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
  const statusNames={active:'Medicaid Active',inactive:'Medicaid Inactive',unable_to_verify:'Unable to Verify'};
  const discrepancyNames={eligibility_not_verified_for_service_date:'Eligibility not verified for today',eligibility_unavailable:'Eligibility unavailable',eligibility_inactive_review_required:'Inactive eligibility requires review',authorization_unavailable:'Authorization information unavailable',authorization_dates_need_review:'Authorization dates require review'};
  const holdNames={source_missing:'Missing from completed source roster',source_inactive:'Inactive in source roster',source_unreconciled:'Source review required',roster_incomplete:'Roster scan incomplete or expired',identity_unindexed:'Identity matching incomplete',duplicate_identity:'Duplicate identity requires review',duplicate_link:'Another record is selected for verification'};
  const when=value=>{if(!value)return 'Not available';const d=new Date(value);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Chicago'}).format(d):'Not available';};
  const range=value=>value?[value.effective||'Start unavailable',value.termination||'End unavailable'].join(' – '):'Not provided';
  const can=permission=>actor?.grant.permissions.includes('eligibility.'+permission);
  const banner=make('p','Sign in to view eligibility.','office-alert');banner.setAttribute('role','status');
  const summary=make('div',undefined,'manager-stats'),timing=make('p'),filters=make('form',undefined,'workforce-filters manager-form');
  function control(label,name,options){const wrapper=make('label',label),input=make(options?'select':'input');input.name=name;
    if(options)for(const [value,text]of options){const option=make('option',text);option.value=value;input.append(option);}else input.maxLength=100;
    wrapper.append(input);filters.append(wrapper);return input;}
  const office=control('Office','office',[]),department=control('Department','department'),mco=control('Managed-care organization','mco');
  const status=control('Eligibility status','status',[['','All'],['active','Active'],['inactive','Inactive'],['unable_to_verify','Unable to Verify']]);
  const from=control('Verified on or after','verifiedAfter'),to=control('Verified on or before','verifiedBefore');from.type=to.type='date';
  const assigned=control('Assignment','assignment',[['','Everyone'],['mine','Assigned to me']]);
  const queue=control('Review queue','queue',[['','Active client records'],['review','Pending review'],['changes','Eligibility changed'],['duplicates','Duplicate identities'],['missing','Missing from source'],['holds','Verification holds'],['inactive','Inactive source records']]);
  const refresh=make('button','Apply filters');refresh.type='submit';filters.append(refresh);
  const tableWrap=make('div',undefined,'eligibility-table-wrap'),table=make('table'),head=make('thead'),headRow=make('tr'),body=make('tbody');
  for(const label of ['Client','Medicaid ID','Eligibility / dates','MCO enrollment','Verification','Authorization dates','Department / assignment','Review']){const th=make('th',label);th.scope='col';headRow.append(th);}
  head.append(headRow);table.append(head,body);tableWrap.append(table);
  const more=make('button','Load more clients');more.type='button';more.hidden=true;
  const detail=make('section',undefined,'manager-card');detail.hidden=true;
  const notice=make('p','Coverage, MCO enrollment and PAS authorization are separate. Review discrepancies before care decisions. Counts include duplicate source records.','manager-record-meta');
  panel.append(banner,summary,timing,filters,notice,tableWrap,more,detail);
  function clear(){generation++;request++;actor=null;rows=[];reviewers=[];next=null;ready=false;pendingKeys.clear();body.replaceChildren();summary.replaceChildren();detail.replaceChildren();detail.hidden=true;more.hidden=true;timing.textContent='';office.replaceChildren();assigned.replaceChildren();filters.reset();banner.textContent='Sign in to view eligibility.';}
  function stats(data){summary.replaceChildren();for(const [label,value]of [['Active client records',data?.total],['Medicaid Active',data?.active],['Medicaid Inactive',data?.inactive],['Unable to Verify',data?.unable_to_verify],['Pending Review',data?.pendingReview],['Eligibility changed',data?.changed],['Verification holds',data?.reconciliationHolds]]){
    const card=make('article');card.append(make('span',label),make('strong',value===undefined?'—':String(value)));summary.append(card);}}
  function addCell(row,text){const cell=make('td',text);row.append(cell);return cell;}
  function render(){body.replaceChildren();for(const member of rows){const tr=make('tr');
    addCell(tr,member.displayName+' · '+member.memberId);const identityCell=addCell(tr,member.medicaidId);
    if(member.identityReady&&can('identifiers')){const reveal=make('button','View Medicaid ID');reveal.type='button';identityCell.append(reveal);reveal.onclick=async()=>{
      const version=generation;reveal.disabled=true;
      try{const result=await workforceApi('/staff/eligibility/'+member.key+'/identifier',{});if(version!==generation||!body.contains(tr))return;
        const text=make('span',result.medicaidId||'Unavailable'),hide=make('button','Hide ID');hide.type='button';identityCell.replaceChildren(text,hide);
        hide.onclick=()=>identityCell.replaceChildren(make('span','Protected'),reveal);
      }catch{if(version===generation)banner.textContent='Medicaid ID access is unavailable.';}finally{if(version===generation)reveal.disabled=false;}
    };}
    addCell(tr,(statusNames[member.latest?.status]||'Unable to Verify')+'\n'+range(member.latest?.coverage));
    addCell(tr,member.latest?.mco===null||!member.latest?'Not provided':member.latest.mco.length?member.latest.mco.map(m=>[m.name||'Name unavailable',m.planCode||'',range(m)].filter(Boolean).join(' · ')).join('\n'):'No enrollment returned');
    addCell(tr,(member.latest?when(member.latest.checkedAt)+' · '+member.latest.source.toUpperCase()+'\nCoverage checked for '+member.latest.asOf:'Not yet verified')+'\nLast successful: '+when(member.lastSuccessful?.checkedAt));
    const authCell=addCell(tr,member.authorizations===null?'Unavailable':member.authorizations.length?member.authorizations.map(a=>range(a)).join('\n')+'\nHHAeXchange · '+when(member.authorizationsFetchedAt):'No authorization returned');
    for(const flag of member.discrepancies||[])if(discrepancyNames[flag])authCell.append(make('p',discrepancyNames[flag],'manager-record-meta'));
    addCell(tr,member.department+'\n'+(member.assignee===actor?.uid?'Assigned to you':member.assignee?reviewers.find(p=>p.uid===member.assignee)?.name||'Assigned to staff':'Unassigned'));
    const actions=addCell(tr,member.reconciliation?.hold?'Review required':member.review==='none'?'No open review':member.review.replaceAll('_',' '));
    if(member.reconciliation?.hold)actions.append(make('p',holdNames[member.reconciliation.hold]||'Verification held'));
    if(member.reconciliation?.duplicate&&can('review')){const reconcile=make('button','Review duplicate');reconcile.type='button';reconcile.onclick=()=>openDuplicate(member);actions.append(reconcile);}
    const history=make('button','History / follow-up');history.type='button';history.onclick=()=>openReview(member);actions.append(history);
    if(can('verify')){const verify=make('button','Verify now');verify.type='button';verify.disabled=!ready||!!member.reconciliation?.hold;verify.onclick=async()=>{
      const version=generation;verify.disabled=true;let key=pendingKeys.get(member.key);if(!key){key=crypto.randomUUID();pendingKeys.set(member.key,key);}
      try{await workforceApi('/staff/eligibility/'+member.key+'/verify',{idempotencyKey:key});if(version!==generation)return;pendingKeys.delete(member.key);banner.textContent='Verification queued. Refresh to see the result.';}
      catch{if(version===generation)banner.textContent='Verification could not be queued. Check your access or contact the office administrator.';}
      finally{if(version===generation)verify.disabled=!ready||!!member.reconciliation?.hold;}
    };actions.append(verify);}
    body.append(tr);
  }if(!rows.length){const tr=make('tr'),cell=make('td','No eligibility records match this view.');cell.colSpan=8;tr.append(cell);body.append(tr);}}
  async function load(append=false){if(!can('read')||!office.value)return;const version=generation,sequence=++request;refresh.disabled=true;more.disabled=true;detail.hidden=true;
    const query={department:department.value,mco:mco.value,status:status.value,verifiedAfter:from.value,verifiedBefore:to.value,
      assignee:assigned.value==='mine'?actor.uid:assigned.value,reviewOnly:queue.value==='review',changedOnly:queue.value==='changes',reconciliation:['duplicates','missing','holds','inactive'].includes(queue.value)?queue.value:''};
    banner.textContent='Loading eligibility records…';
    try{const result=await workforceApi('/staff/eligibility/query',{office:office.value,filters:query,after:append?next||'':''});
      if(version!==generation||sequence!==request)return;ready=result.connectionReady===true;stats(result.summary);
      reviewers=result.reviewers||[];const selectedAssignee=assigned.value;assigned.replaceChildren();
      for(const [value,label]of [['','Everyone'],['mine','Assigned to me'],...reviewers.filter(p=>p.uid!==actor.uid).map(p=>[p.uid,p.name])]){const option=make('option',label);option.value=value;assigned.append(option);}assigned.value=selectedAssignee;
      rows=append?[...rows,...result.items]:result.items;next=result.next;more.hidden=!next;
      banner.textContent=!result.available?'Eligibility access is awaiting activation. No live eligibility connection is active.':
        (ready?'Eligibility connection enabled. ':'Direct TMHP connection awaiting approval and certification. ')+
        (result.rosterComplete?'Counts cover the synchronized roster.':'Roster synchronization is incomplete; counts cover synchronized clients only.')+(result.summaryComplete===false?' Summary limit reached.':'');
      timing.textContent='Last successful verification: '+when(result.summary?.lastSuccessful)+' · Next scheduled verification: '+(result.nextScheduled?when(result.nextScheduled):'Not enabled')+' · America/Chicago'+
        (result.rosterProgress?' · Source roster: '+result.rosterProgress.phase+' · '+result.rosterProgress.processed+'/'+result.rosterProgress.total:'');render();
    }catch{if(version===generation&&sequence===request){rows=[];render();stats(null);timing.textContent='';banner.textContent='Eligibility records are unavailable. Sign in again if your session expired, or contact the office administrator.';more.hidden=true;}}
    finally{if(version===generation&&sequence===request){refresh.disabled=false;more.disabled=false;}}
  }
  async function openDuplicate(member){const version=generation,area=make('div');detail.replaceChildren(make('h3',member.displayName+' — duplicate review'),area);detail.hidden=false;
    const close=make('button','Close');close.type='button';close.onclick=()=>{detail.replaceChildren();detail.hidden=true;};detail.append(close);
    try{const result=await workforceApi('/staff/eligibility/'+member.key+'/reconciliation',{});if(version!==generation||!detail.contains(area))return;
      area.append(make('p','Select the source record to use for eligibility checks. Linked records and their history remain preserved. This decision does not merge HHA records or change care.'));
      if(!result.canResolve){area.append(make('p','A reviewer with access to every linked office must resolve this duplicate.'));return;}
      const form=make('form',undefined,'manager-form'),choiceLabel=make('label','Record for verification'),choice=make('select'),noteLabel=make('label','Reconciliation reason'),note=make('textarea');
      choice.required=true;for(const linked of result.members){const option=make('option',linked.displayName+' · '+linked.memberId+' · '+linked.office);option.value=linked.key;
        option.disabled=!linked.active||linked.sourceState!=='present';choice.append(option);}choice.value=result.state.canonicalKey||'';choiceLabel.append(choice);note.required=true;note.maxLength=2000;noteLabel.append(note);
      const save=make('button','Save selected record'),message=make('p');save.type='submit';form.append(choiceLabel,noteLabel,save,message);area.append(form);
      form.onsubmit=async event=>{event.preventDefault();save.disabled=true;try{await workforceApi('/staff/eligibility/'+member.key+'/canonical',{revision:result.revision,canonicalKey:choice.value,note:note.value});
        if(version===generation&&detail.contains(area)){detail.replaceChildren();detail.hidden=true;await load();}}
        catch{if(version===generation&&detail.contains(area))message.textContent='Selection was not saved. Refresh to check roster, access or identity changes.';}finally{save.disabled=false;}};
    }catch{if(version===generation&&detail.contains(area))area.textContent='Duplicate review is unavailable.';}
  }
  async function openReview(member){const version=generation;detail.replaceChildren(make('h3',member.displayName+' — verification history'));detail.hidden=false;
    const close=make('button','Close');close.type='button';close.onclick=()=>{detail.replaceChildren();detail.hidden=true;};detail.append(close);
    const resultArea=make('div');detail.append(resultArea);
    try{const history=await workforceApi('/staff/eligibility/'+member.key+'/history',{});if(version!==generation||!detail.contains(resultArea))return;
      for(const result of history.results)resultArea.append(make('p',when(result.checkedAt)+' · '+statusNames[result.status]+' · For '+result.asOf));
      for(const note of history.notes)resultArea.append(make('p',when(note.at)+' · '+note.note));
      if(!history.results.length&&!history.notes.length)resultArea.append(make('p','No history recorded.'));
      resultArea.append(make('p','Showing up to '+history.limitedTo+' recent verifications and follow-up entries.'));
    }catch{if(version===generation)resultArea.textContent='History is unavailable.';}
    if(version!==generation||!can('review')||!detail.contains(resultArea))return;
    const form=make('form',undefined,'manager-form'),noteLabel=make('label','Follow-up actions'),note=make('textarea');note.required=true;note.maxLength=2000;noteLabel.append(note);
    const deptLabel=make('label','Responsible department'),dept=make('input');dept.value=member.department;dept.required=true;dept.maxLength=100;deptLabel.append(dept);
    const assignLabel=make('label','Assigned employee'),assign=make('select');
    for(const [value,label]of [['','Unassigned'],...reviewers.map(p=>[p.uid,p.uid===actor.uid?'Assigned to me':p.name])]){const option=make('option',label);option.value=value;assign.append(option);}
    if(member.assignee&&!reviewers.some(p=>p.uid===member.assignee)){const option=make('option','Previously assigned staff');option.value=member.assignee;assign.append(option);}assign.value=member.assignee||'';assignLabel.append(assign);
    const actionLabel=make('label','Review status'),action=make('select');for(const [v,t]of [['in_progress','In progress'],['resolved','Reviewed / resolved']]){const op=make('option',t);op.value=v;action.append(op);}actionLabel.append(action);
    const save=make('button','Save follow-up');save.type='submit';const message=make('p');message.setAttribute('role','status');
    form.append(noteLabel,deptLabel,assignLabel,actionLabel,save,message);detail.append(form);
    form.onsubmit=async event=>{event.preventDefault();save.disabled=true;try{await workforceApi('/staff/eligibility/'+member.key+'/review',{revision:member.revision,action:action.value,note:note.value,department:dept.value,assignee:assign.value||null});
      if(version===generation){detail.replaceChildren();detail.hidden=true;await load();}}
      catch{if(version===generation)message.textContent='The review was not saved. Refresh to check for changes or renewed access.';}finally{if(version===generation)save.disabled=false;}};
  }
  filters.onsubmit=event=>{event.preventDefault();load();};more.onclick=()=>load(true);
  for(const button of document.querySelectorAll('[data-manager-go="eligibility"]'))button.addEventListener('click',()=>load());
  document.addEventListener('workforce-session-cleared',clear);
  document.addEventListener('workforce-session',event=>{clear();actor=event.detail;for(const id of actor.grant.offices){const option=make('option',id);option.value=id;office.append(option);}stats(null);});
})();
