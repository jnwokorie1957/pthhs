/* HHA reads use the existing verified workforce session and source gates. */
(() => {
  let generation = 0;
  const node = (tag, text) => { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; return el; };
  const titles = {'weekly-availability':'Weekly availability','special-availability':'Special availability',training:'In-service training',preferences:'Work languages','pay-rates':'My pay rates'};
  const labels = {FromDate:'From date',ToDate:'Through date',InserviceDate:'Training date',FromTime:'Start time',EndTime:'End time',NoShow:'No-show status','NoShowReason/Name':'No-show reason',InserviceCountCompliance:'Counts toward compliance',Language1:'Language',Language2:'Additional language',Language3:'Additional language',Language4:'Additional language',Discipline:'Discipline',HourlyRate:'Hourly rate',DailyRate:'Daily rate',VisitRate:'Visit rate',Status:'Status'};
  const label = key => labels[key] || key.replace(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(AvailabilityType|From|To|LiveIn)/, (_,day,field) => day+' '+({AvailabilityType:'availability',From:'from',To:'to',LiveIn:'live-in'}[field]));
  const value = input => input === null || input === undefined ? 'Not supplied' : input === '' ? 'Empty in HHA' : String(input);
  function mount(target, {api, base='/application/hha-records/', self=true, current=()=>true} = {}) {
    const token = generation, valid = () => token === generation && current();
    const root = node('section'); root.className = 'hha-records'; root.dataset.recordGroup = 'hha';
    root.append(node('h3','HHA work records'),node('p','View records from HHAeXchange. Contact the office to request changes. Dates and times appear as recorded by HHA.'));
    for (const [kind,title] of Object.entries(titles)) {
      if (!self && kind === 'pay-rates') continue;
      const card = node('section'); card.className = 'hha-record-card';
      const heading = node('h4',title),button = node('button','Load '+title.toLowerCase()),status = node('p'),body = node('div');
      button.type = 'button'; button.className = 'btn-secondary';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
      let busy = false;
      button.onclick = async () => {
        if (busy || !valid()) return;
        busy = true; button.disabled = true; body.replaceChildren(); status.textContent = 'Loading from HHA…';
        try {
          const data = await api(base+kind); if (!valid()) return;
          if (data.kind !== kind || data.source !== 'hhaexchange' || !Array.isArray(data.items)) throw Error('Invalid source');
          for (const [index,row] of data.items.entries()) {
            const record = node('article');record.className = 'hha-record-item';record.append(node('h5',title+' '+(index+1)));
            const fields = node('dl');fields.className = 'hha-contact-grid';
            for (const [key,input] of Object.entries(row)) {const group=node('div');group.append(node('dt',label(key)),node('dd',value(input)));fields.append(group);}
            record.append(fields);body.append(record);
          }
          status.textContent = (data.items.length ? data.items.length+' record'+(data.items.length===1?'':'s')+' loaded.' : data.truncated ? 'No records in the returned portion.' : 'HHA returned no records for this view.')+(data.truncated?' Partial results; contact the office for the complete list.':'')+(data.fetchedAt?' Checked '+new Date(data.fetchedAt).toLocaleString()+'.':'');
          button.textContent = 'Refresh '+title.toLowerCase();
        } catch (error) {
          if (valid()) status.textContent = /hha_record_connection_pending/.test(error.code||error.message||'') ? 'This HHA connection is awaiting office enablement.' : 'These HHA records could not be loaded. Try again or contact the office.';
        } finally {if (valid()) {busy=false;button.disabled=false;}}
      };
      card.append(heading,button,status,body);root.append(card);
    }
    if (!self) {
      const link=node('a','Open Operations');link.href='/primetime';link.className='btn-secondary';
      root.append(node('p','Patient, visit, payroll, billing and clinical tools use the separate Operations sign-in and permissions.'),link);
    }
    target.append(root);return root;
  }
  document.addEventListener('workforce-session-cleared',()=>{generation++;for(const el of document.querySelectorAll('.hha-records'))el.replaceChildren();});
  window.WorkforceHhaRecords={mount};
})();
