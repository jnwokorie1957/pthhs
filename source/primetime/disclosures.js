(() => {
  const sections=[];
  window.primetimeReveal=node=>{for(let parent=node?.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;};
  function compact(panel){
    if(!panel||panel.tagName==='DETAILS'||panel.querySelector(':scope > .workspace-disclosure'))return;
    const heading=panel.querySelector(':scope > h3,:scope > .panel-head h3');if(!heading)return;
    const disclosure=document.createElement('details'),summary=document.createElement('summary'),body=document.createElement('div');
    disclosure.className='workspace-disclosure';body.className='workspace-disclosure-body';summary.append(heading);
    while(panel.firstChild)body.append(panel.firstChild);disclosure.append(summary,body);panel.append(disclosure);sections.push(disclosure);
    disclosure.addEventListener('toggle',()=>{if(disclosure.open){if(panel.closest('#operationalWorkspace'))for(const other of sections)if(other!==disclosure&&other.closest('#operationalWorkspace'))other.open=false;window.dispatchEvent(new Event('resize'));}});
  }
  for(const panel of document.querySelectorAll('.connected-tools'))compact(panel);
  for(const form of document.querySelectorAll('#operationalWorkspace form'))compact(form.closest('.panel'));
  for(const id of ['dashboardEvidenceChart','dashboardOverviewExceptions','dashboardCoverage','dashboardAlerts','dashboardReadiness','formUpload'])compact(document.getElementById(id)?.closest('.panel'));
  document.addEventListener('primetime-signed-out',()=>{for(const section of sections)section.open=false;});
})();
