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
  const buttons=[];for(const [style,label]of [['cursive','Use my name in cursive'],['drawn','Draw my signature']]){const button=document.createElement('button');button.type='button';button.className='btn-secondary';button.textContent=label;button.disabled=readOnly;button.onclick=()=>{value=style==='cursive'?{style}:{style,strokes:[]};update();onChange();};buttons.push([style,button]);actions.append(button);}
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
