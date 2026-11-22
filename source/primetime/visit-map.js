(() => {
  'use strict';
  const office = { label: 'Office', address: '11602 Burdine St, Houston, TX 77035', point: [29.654012, -95.480963] };
  const element = (tag, text, cls) => {
    const el = document.createElement(tag);
    if (text) el.textContent = text;
    if (cls) el.className = cls;
    return el;
  };
  function button(label, action) {
    const b = element('button', label, 'btn secondary');
    b.type = 'button'; b.addEventListener('click', action); return b;
  }
  const geographic = ([lat, lon]) => [(lon + 97) * 865, (31 - lat) * 1000];
  function overview(stops, roads) {
    const figure = element('figure', '', 'visit-map-figure');
    const svg = (tag, attrs, text) => {
      const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
      for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, String(value));
      if (text) el.textContent = text;
      return el;
    };
    const map = svg('svg', {viewBox:'0 0 640 300', role:'img', 'aria-label':'Greater Houston stop locations in itinerary order'});
    const points = [office, ...stops, office].map(stop => stop.point ? geographic(stop.point) : null);
    const known = points.filter(Boolean), xs = known.map(p => p[0]), ys = known.map(p => p[1]);
    const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
    const scale = Math.min(520 / Math.max(right-left, 48), 218 / Math.max(bottom-top, 30));
    const x = value => 320 + (value-(left+right)/2)*scale, y = value => 150 + (value-(top+bottom)/2)*scale;
    map.append(svg('rect', {width:640,height:300,fill:'#eff4f0'}), svg('image', {href:roads, x:x(0), y:y(0), width:3000*scale, height:3000*scale}));
    for (let i=1; i<points.length; i++) {
      const prev=points[i-1], next=points[i];
      if (prev && next) map.append(svg('line', {x1:x(prev[0]),y1:y(prev[1]),x2:x(next[0]),y2:y(next[1]),stroke:'#006762','stroke-width':3,'stroke-dasharray':'6 5'}));
    }
    const markers = new Map();
    points.slice(0,-1).forEach((pt, i) => {
      if (!pt) return;
      const id=pt.join(',');
      if (!markers.has(id)) markers.set(id, {pt, numbers:[]});
      markers.get(id).numbers.push(i);
    });
    const placed=[];
    for (const {pt,numbers} of markers.values()) {
      const px=x(pt[0]), py=y(pt[1]);
      const label=numbers.map(i=>i || 'Office').join(', ');
      const display=label.length>16 ? numbers[0]+' +'+(numbers.length-1) : label;
      const width=Math.max(28,display.length*8+14), cx=Math.max(width/2+2,Math.min(638-width/2,px));
      let cy=py;
      for (let n=0;n<12 && placed.some(p=>Math.abs(cx-p.x)<(width+p.w)/2+4 && Math.abs(cy-p.y)<25);n++)
        cy=py+(n%2===0?-1:1)*(1+Math.floor(n/2))*26;
      cy=Math.max(14,Math.min(286,cy)); placed.push({x:cx,y:cy,w:width});
      const group=svg('g',{}); group.append(svg('title',{},label),svg('line',{x1:px,y1:py,x2:cx,y2:cy,stroke:'#184743'}),svg('circle',{cx:px,cy:py,r:3,fill:'#184743'}),
        svg('rect',{x:cx-width/2,y:cy-11,width,height:22,rx:8,fill:numbers.includes(0)?'#263c50':'#006762'}),
        svg('text',{x:cx,y:cy+4,'text-anchor':'middle',fill:'white','font-family':'sans-serif','font-size':13,'font-weight':'bold'},display));
      map.append(group);
    }
    map.append(svg('text',{x:618,y:22,'text-anchor':'end',fill:'#354d4d','font-size':14},'↑ N'));
    figure.append(map,element('figcaption','Numbered stops follow the list below. Dashed lines show stop order. Road basemap: U.S. Census Bureau, 2026 TIGER/Line.'));
    if (known.length<points.length) figure.append(element('p','Some ZIPs have no local map coordinates. Their stops are listed below.'));
    return figure;
  }
  function mount(host, settings) {
    let stops=[...settings.stops], saved=[...stops], estimates=settings.estimates, saving=false, error='', showGoogle=Boolean(settings.embedKey || settings.sampleMaps), mapPart=0;
    function draw(focus) {
      const dirty=stops.some((s,i)=>s!==saved[i]), points=[office,...stops.filter((s,i)=>!i || s.address!==stops[i-1].address),office];
      const parts=[];
      for(let i=0;i+1<points.length;i+=4) parts.push(points.slice(i,i+5));
      mapPart=Math.min(mapPart,parts.length-1);
      const region=element('section','','visit-route-preview'), list=element('ol','','visit-route-stops');
      host.replaceChildren(region);
      region.append(element('h4','Projected route'),element('p',settings.description));
      const sampleMap = settings.sampleMaps?.[stops[0]?.id];
      if (settings.embedKey || sampleMap) region.append(button(showGoogle?'Show stop overview':'Show Google road map',()=>{showGoogle=!showGoogle;draw();}));
      if ((settings.embedKey || sampleMap) && showGoogle) {
        const part=parts[mapPart], params=new URLSearchParams({key:settings.embedKey,origin:part[0].address,destination:part.at(-1).address,mode:'driving'});
        if (part.length>2) params.set('waypoints',part.slice(1,-1).map(s=>s.address).join('|'));
        const frame=element('iframe','','visit-road-map'); frame.title='Google driving route, part '+(mapPart+1); frame.referrerPolicy='strict-origin-when-cross-origin';
        frame.src=sampleMap?.url || 'https://www.google.com/maps/embed/v1/directions?'+params;
        region.append(frame);
        if(parts.length>1) parts.forEach((_,i)=>{const b=button('Map part '+(i+1),()=>{mapPart=i;draw();});b.disabled=i===mapPart;region.append(b);});
      } else region.append(overview(stops,settings.roads || '/primetime/houston-roads.svg'));
      region.append(element('p','Start and finish at the Houston office.')); region.append(list);
      const controls=[];
      stops.forEach((s,i)=>{
        const li=element('li'), row=element('div','','visit-stop-row'); li.append(row);list.append(li);
        row.append(element('span',s.label));
        if(stops.length<2) return;
        const buttons=element('div','','visit-stop-actions'); row.append(buttons); controls[i]=[];
        for(const delta of [-1,1]) {
          const dest=i+delta, dir=delta<0?'earlier':'later';
          const b=button(delta<0?'↑':'↓',()=>{
            if(saving || dest<0 || dest>=stops.length)return;
            [stops[i],stops[dest]]=[stops[dest],stops[i]];error='';mapPart=0;
            draw({index:dest,dir:dest===0?1:dest===stops.length-1?0:delta>0?1:0});
          });
          b.setAttribute('aria-label','Move '+s.label+' '+dir); b.title='Move '+dir;b.disabled=saving || dest<0 || dest>=stops.length;
          controls[i].push(b);buttons.append(b);
        }
      });
      if(focus) controls[focus.index]?.[focus.dir]?.focus?.();
      if(dirty) {
        region.append(element('p',settings.save?'Edited order. Save to update the office record and driving estimate.':'Sample order changed.'));
        if(settings.save){const b=button(saving?'Saving…':'Save revised route',async()=>{
          if(saving)return;saving=true;draw();
          try{ const result=await settings.save(stops); if(!result)return;estimates=result;saved=[...stops];error='';}
          catch(e){error=settings.errorText?.(e) || 'Could not save this order. Try again.';}
          finally{saving=false;if(settings.active())draw();}
        });b.disabled=saving;region.append(b);}
        const undo=button('Undo changes',()=>{stops=[...saved];error='';draw();});undo.disabled=saving;region.append(undo);
      } else if(Number.isFinite(estimates?.minutes) && Number.isFinite(estimates?.miles)) {
        region.append(element('p',Math.round(estimates.minutes)+' min driving · '+estimates.miles.toFixed(1)+' mi'));
      } else if(!sampleMap) region.append(element('p',settings.save?'Traffic and mileage estimates are unavailable for this plan.':'Live travel estimates are available in Google Maps.'));
      if(sampleMap) region.append(element('p','Google Maps sample on Nov 22 · '+sampleMap.minutes+' min driving · '+sampleMap.miles+' mi'));
      if(error)region.append(element('p',error));
      parts.forEach((part,index)=>{
        const params=new URLSearchParams({api:'1',origin:part[0].address,destination:part.at(-1).address,travelmode:'driving'});
        if(part.length>2)params.set('waypoints',part.slice(1,-1).map(s=>s.address).join('|'));
        const a=element('a',parts.length===1?'Open in Google Maps':'Open route part '+(index+1)+' in Google Maps','btn secondary');
        a.href='https://www.google.com/maps/dir/?'+params;a.target='_blank';a.rel='noopener noreferrer';region.append(a);
      });
    }
    draw();
  }
  function sample(host, roads) {
    // These fixed, public sample URLs come from Google Maps' Share or embed map dialog.
    const sampleMaps = {
      walker: { minutes:34, miles:11.6, url:'https://www.google.com/maps/embed?pb=!1m40!1m12!1m3!1d55461.17944872346!2d-95.54229195567414!3d29.68139302747228!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!4m25!3e6!4m5!1s0x8640e9f4c4b89da9%3A0xfb06c9d39582f7d3!2s11602%20Burdine%20St%2C%20Houston%2C%20TX%2077035!3m2!1d29.6537309!2d-95.48112189999999!4m5!1s0x8640e96b6458b42d%3A0x7c74c9c5bd69f3ba!2s11630%20Chimney%20Rock%20Rd%2C%20Houston%2C%20TX%2077035!3m2!1d29.653430099999998!2d-95.4821103!4m5!1s0x8640c2f816e9152f%3A0x2e9af5987608523b!2s7660%20Clarewood%20Dr%2C%20Houston%2C%20TX%2077036!3m2!1d29.7097493!2d-95.52088719999999!4m5!1s0x8640e9f4c4b89da9%3A0xfb06c9d39582f7d3!2s11602%20Burdine%20St%2C%20Houston%2C%20TX%2077035!3m2!1d29.6537309!2d-95.48112189999999!5e0!3m2!1sen!2sus!4v1795379873794!5m2!1sen!2sus' },
      walter: { minutes:34, miles:11.7, url:'https://www.google.com/maps/embed?pb=!1m40!1m12!1m3!1d55461.17944872346!2d-95.54229195567414!3d29.68139302747228!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!4m25!3e6!4m5!1s0x8640e9f4c4b89da9%3A0xfb06c9d39582f7d3!2s11602%20Burdine%20St%2C%20Houston%2C%20TX%2077035!3m2!1d29.6537309!2d-95.48112189999999!4m5!1s0x8640c2f816e9152f%3A0x2e9af5987608523b!2s7660%20Clarewood%20Dr%2C%20Houston%2C%20TX%2077036!3m2!1d29.7097493!2d-95.52088719999999!4m5!1s0x8640e96b6458b42d%3A0x7c74c9c5bd69f3ba!2s11630%20Chimney%20Rock%20Rd%2C%20Houston%2C%20TX%2077035!3m2!1d29.653430099999998!2d-95.4821103!4m5!1s0x8640e9f4c4b89da9%3A0xfb06c9d39582f7d3!2s11602%20Burdine%20St%2C%20Houston%2C%20TX%2077035!3m2!1d29.6537309!2d-95.48112189999999!5e0!3m2!1sen!2sus!4v1795379900498!5m2!1sen!2sus' }
    };
    mount(host,{roads,sampleMaps,description:'Two public libraries stand in for the admission and supervisory visit. Move a stop to try another order.',
      stops:[{id:'walker',label:'77035 — Admission · Walker Neighborhood Library',address:'11630 Chimney Rock Rd, Houston, TX 77035',point:[29.653349,-95.480733]},
        {id:'walter',label:'77036 — Supervisory visit · Walter Neighborhood Library',address:'7660 Clarewood Dr, Houston, TX 77036',point:[29.709683,-95.520362]}]});
  }
  window.primetimeVisitMap={mount,sample};
})();
