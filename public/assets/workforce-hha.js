(() => {
 const panel=document.getElementById('caregiver-hha-profile'),urls=new Set(),windows=new Set();let generation=0;
 const node=(tag,text)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;return element;};
 const labels={'EmployeeID':'Employee ID','EmployeeType':'Employee type','HireDate':'Hire date','FirstWorkDate':'First work date','LastWorkDate':'Last work date','BirthDate':'Date of birth','Team/Name':'Team','Branch/Name':'Branch','Location/Name':'Location','EmploymentDisciplines':'Employment disciplines','ProfessionalLicensenumber':'Professional license','NPINumber':'NPI','Language1':'Language','Language2':'Additional language','Language3':'Additional language','Language4':'Additional language'};
 function clear(){generation++;if(panel){panel.hidden=true;panel.replaceChildren();}for(const url of urls)URL.revokeObjectURL(url);urls.clear();for(const preview of windows){try{preview.close();}catch{}}windows.clear();}
 function grid(target,values){const list=node('dl');list.className='hha-contact-grid';for(const [label,value]of values){const group=node('div');group.append(node('dt',label),node('dd',value||'Not supplied'));list.append(group);}target.append(list);}
 function render(target,data,api,base,current=()=>true){
  const p=data.profile,f=p.fields||{};target.append(node('h2',[p.firstName,p.lastName].filter(Boolean).join(' ')),node('p','HHAeXchange · '+p.code+' · '+p.status));
  target.append(node('h3','Contact information'));grid(target,[['Email',p.email],['Home phone',f['Address/HomePhone']],['Alternate phone',f['Address/Phone2']],['Mobile / SMS',f['NotificationPreferences/MobileOrSMS']],['Street address',[f['Address/Street1'],f['Address/Street2']].filter(Boolean).join(', ')],['City / state / ZIP',[f['Address/City'],f['Address/State'],f['Address/Zip5']].filter(Boolean).join(', ')]]);
  target.append(node('h3','Employment information'));grid(target,Object.entries(labels).filter(([key])=>f[key]).map(([key,label])=>[label,key==='EmploymentDisciplines'?(()=>{try{return JSON.parse(f[key]).join(', ');}catch{return f[key];}})():f[key]]));
  if(data.application!==undefined)target.append(node('p',data.application==='not_on_file'?'Application not on file.':'Application: '+data.application));
  target.append(node('h3','Files from HHAeXchange'));const message=node('p');message.setAttribute('role','status');target.append(message);
  if(data.filesUnavailable){message.textContent=data.filesPermissionDenied?'Private file access is required.':'HHA file access is not connected yet.';return;}
  if(!data.files?.items.length)message.textContent='HHA returned no files for this caregiver.';
  if(data.files?.truncated)message.textContent='This is a partial file list.';
  for(const file of data.files?.items||[]){const row=node('div');row.className='hha-file';row.append(node('strong',file.name),node('p',file.category));const button=node('button','View file');button.type='button';button.className='btn-secondary';button.onclick=async()=>{
   const preview=window.open('about:blank','_blank');if(preview){preview.opener=null;windows.add(preview);}button.disabled=true;
   try{const blob=await api(base+encodeURIComponent(file.id),undefined,true);if(!current()){preview?.close();return;}const url=URL.createObjectURL(blob);urls.add(url);
    if(blob.type==='application/pdf'&&preview&&!preview.closed)preview.location.replace(url);else{preview?.close();const link=node('a','Download file');link.href=url;link.download=file.name;row.append(link);link.click();}
   }catch(error){preview?.close();if(current())message.textContent=error.message;}finally{if(current())button.disabled=false;}
  };row.append(button);target.append(row);}
 }
 async function open(api){if(!panel)return;clear();panel.hidden=false;panel.append(node('p','Loading your HHA profile…'));const sequence=generation;try{const data=await api('/application/hha-profile');if(sequence!==generation)return;panel.replaceChildren();render(panel,data,api,'/application/hha-files/',()=>sequence===generation);}catch(error){if(sequence===generation)panel.replaceChildren(node('p',error.message));}}
 window.WorkforceHha={open,render,clear};document.addEventListener('workforce-session-cleared',clear);
})();
