(() => {
  const central='America/Chicago';
  const weekdays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const dateAt = day => new Date(day + 'T12:00:00Z');
  function plus(day, offset) {
    const date = dateAt(day);
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0,10);
  }
  const dateLabel = day => dateAt(day).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
  const timeLabel = time => new Date('2000-01-01T'+time+':00Z').toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZone:'UTC'});
  function stamp(value) {
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value))return null;
    const date=new Date(value);
    if(!Number.isFinite(date.getTime())||date.toISOString()!==value)return null;
    return date.toLocaleString('en-US',{timeZone:central,month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
  }
  function node(tag, text, cls) {
    const result = document.createElement(tag);
    if (text) result.textContent = text;
    if (cls) result.className = cls;
    return result;
  }
  function button(text, action, primary=false) {
    const result = node('button',text,primary?'btn-primary':'btn-secondary');
    result.type='button'; result.onclick=action; return result;
  }
  function describe(s, zone='Central') {
    return s.days.map(d=>weekdays[d].slice(0,3)).join(', ')+' · '+timeLabel(s.from)+' – '+timeLabel(s.to)+' '+zone;
  }
  function input(parent, title, type, value, required) {
    const label=node('label',title,'application-label'), field=node('input');
    field.type=type; field.value=value; field.required=required; label.append(field); parent.append(label); return field;
  }
  async function office(target, opening, applicant, path, api, current) {
    const status=node('p','Loading schedule…'); status.setAttribute('role','status'); target.append(status);
    let record;
    try { record=await api(path); } catch(error) { if(current())status.textContent=error.message; return; }
    if(!current())return;
    const body=node('section','','portal-task'); target.append(body);status.textContent='';
    function display() {
      const s=record.schedule;
      body.replaceChildren(node('h3',s?'Confirmed schedule':'Assignment schedule'));
      if(s) body.append(node('p','Starts '+dateLabel(s.start)+(s.end?' · Ends '+dateLabel(s.end):'')),node('p',describe(s)));
      body.append(button(s?'Edit shifts':'Set start date and shifts',editor));
    }
    function editor() {
      status.textContent='';
      const s=record.schedule, form=node('form');
      window.WorkforceOverlay.open(form,{title:'Confirm weekly shifts',onClose:()=>{if(current())display();}});
      form.append(node('p',applicant.name+' · '+opening.public.location+' · '+opening.public.weeklyHours+' hours per week'));
      const start=input(form,'Start date','date',s?.start||'',true);
      const end=input(form,'End date (optional)','date',s?.end||'',false);
      const group=node('fieldset');group.append(node('legend','Workdays'));form.append(group);
      const choices=[];
      for(const d of [1,2,3,4,5,6,0]){
        const weekend=d===0||d===6;
        if(opening.public.schedule==='weekdays'&&weekend || opening.public.schedule==='weekends'&&!weekend)continue;
        const label=node('label','','application-check'),check=node('input');
        check.type='checkbox';check.value=String(d);check.checked=s?.days.includes(d)||false;
        label.append(check,document.createTextNode(weekdays[d]));group.append(label);choices.push(check);
      }
      const from=input(form,'Shift starts (Central)','time',s?.from||'',true);
      const to=input(form,'Shift ends (Central, same day)','time',s?.to||'',true);
      const total=node('p'),feedback=node('p');feedback.setAttribute('role','status');
      const days=()=>choices.filter(c=>c.checked).map(c=>Number(c.value));
      function hours(){return Math.max(0,(to.valueAsNumber-from.valueAsNumber)/3600000*days().length)||0;}
      const update=()=>{total.textContent=Number(hours().toFixed(2))+' of '+opening.public.weeklyHours+' weekly hours';end.min=start.value;};
      form.oninput=update;update();
      const save=node('button','Confirm start date and shifts','btn-primary');save.type='submit';
      const close=()=>window.WorkforceOverlay.close(form);
      const cancel=button('Cancel',close);form.append(total,save,cancel,feedback);
      form.onsubmit=async e=>{
        e.preventDefault();
        if(!days().includes(dateAt(start.value).getUTCDay()) || Math.round(hours()*60)!==Math.round(opening.public.weeklyHours*60)){
          feedback.textContent='Choose a start date on a selected workday and match the weekly hours.';return;
        }
        save.disabled=cancel.disabled=true;
        try{
          record=await api(path,{revision:record.revision,schedule:{start:start.value,end:end.value,days:days(),from:from.value,to:to.value}});
          if(current()){close();display();status.textContent='Saved to the caregiver’s schedule.';}
        }catch(error){if(current()){feedback.textContent=error.message;save.disabled=cancel.disabled=false;}}
      };
      start.focus();
    }
    display();
  }
  async function caregiver(target,api,current) {
    const {items,fetchedAt}=await api('/application/schedule');
    if(!current())return;
    target.append(node('p','Schedule checked: '+(stamp(fetchedAt)||'unavailable')));
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:central,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const upcoming=items.filter(i=>!i.schedule.end||i.schedule.end>=today).sort((a,b)=>a.schedule.start.localeCompare(b.schedule.start));
    if(!upcoming.length){target.append(node('p','You have no upcoming office-confirmed assignments.'));return;}
    for(const item of upcoming){
      const {location,schedule:s,weeklyHours}=item;
      const card=node('section','','portal-task');target.append(card);
      if(typeof item.assignmentRef==='string'&&/^[a-f0-9]{64}$/.test(item.assignmentRef))card.setAttribute('data-assignment-ref',item.assignmentRef);
      const zone=item.timeZone===central?'Central':'time zone unavailable';
      const revision=Number.isSafeInteger(item.revision)&&item.revision>0?item.revision:'unavailable';
      card.append(node('h2',location),node('p',item.origin==='office_confirmed_portal'?'Office-confirmed portal assignment':'Assignment source unavailable'),
        node('p','Schedule version '+revision+' · Last office change: '+(stamp(item.updatedAt)||'unavailable')),
        node('p','Starts '+dateLabel(s.start)+(s.end?' · Ends '+dateLabel(s.end):'')+' · '+weeklyHours+' hours per week'),node('p',describe(s,zone)));
      let first=today>s.start?today:s.start;
      const initial=first,dates=node('ul'),range=node('h3');
      const previous=button('Previous 7 days',()=>{first=plus(first,-7);render();});
      const next=button('Next 7 days',()=>{first=plus(first,7);render();});
      function render(){
        dates.replaceChildren();range.textContent='Week of '+dateLabel(first);
        for(let i=0;i<7;i++){const day=plus(first,i);if((!s.end||day<=s.end)&&s.days.includes(dateAt(day).getUTCDay()))dates.append(node('li',dateLabel(day)+' · '+timeLabel(s.from)+' – '+timeLabel(s.to)+' '+zone));}
        if(!dates.children.length)dates.append(node('li','No shifts in this period.'));
        previous.disabled=first===initial;next.disabled=!!s.end&&plus(first,7)>s.end;
      }
      const actions=node('div','','workforce-actions');actions.append(previous,next);card.append(range,dates,actions);render();
    }
  }
  window.WorkforceSchedule={office,caregiver};
})();
