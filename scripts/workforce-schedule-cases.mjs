import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class Element {
 constructor(tag){this.tagName=tag;this.children=[];this.attrs={};this._text='';}
 append(...items){this.children.push(...items);}
 replaceChildren(...items){this.children=[];this._text='';this.append(...items);}
 set textContent(value){this._text=String(value);this.children=[];}
 get textContent(){return this._text+this.children.map(child=>child.textContent).join(' ');}
 setAttribute(key,value){this.attrs[key]=String(value);}
}
const walk=node=>[node,...node.children.flatMap(walk)];
const schedule={start:'2027-01-04',end:'',days:[1,2],from:'08:00',to:'14:00'};
const row=(assignmentRef='a'.repeat(64))=>({assignmentRef,origin:'office_confirmed_portal',timeZone:'America/Chicago',revision:3,updatedAt:'2026-11-24T18:00:00.000Z',location:'Fictional area',weeklyHours:12,schedule});
function fixture(reply){
 const root=new Element('div'),window={},calls=[];
 class FixedDate extends Date {constructor(...args){super(...(args.length?args:['2026-11-25T14:00:00.000Z']));}static now(){return Date.parse('2026-11-25T14:00:00.000Z');}}
 vm.runInNewContext(fs.readFileSync(process.env.SCHEDULE_SCRIPT||new URL('../public/assets/workforce-schedule.js',import.meta.url),'utf8'),{window,document:{createElement:tag=>new Element(tag)},Date:FixedDate,Intl});
 let current=true;
 return {root,calls,close(){current=false;},load:()=>window.WorkforceSchedule.caregiver(root,async path=>{calls.push(path);return typeof reply==='function'?reply():reply;},()=>current)};
}

test('equal-looking calendar cards keep distinct references and separate office changes from the read receipt',async()=>{
 const f=fixture({fetchedAt:'2026-11-25T14:00:00.000Z',items:[row(),row('b'.repeat(64))]});await f.load();
 const cards=walk(f.root).filter(el=>el.className==='portal-task');
 assert.deepEqual(cards.map(card=>card.attrs['data-assignment-ref']),['a'.repeat(64),'b'.repeat(64)]);
 assert.match(f.root.textContent,/Office-confirmed portal assignment/);
 assert.match(f.root.textContent,/Schedule version 3/);
 assert.match(f.root.textContent,/Last office change:.*Nov 24, 2026.*12:00 PM.*CST/);
 assert.match(f.root.textContent,/Schedule checked:.*Nov 25, 2026.*8:00 AM.*CST/);
 assert.match(f.root.textContent,/8:00 AM.*2:00 PM Central/);
 assert.deepEqual(f.calls,['/application/schedule']);
});

test('legacy or malformed metadata stays unavailable without inventing references or displaying raw markers',async()=>{
 const malformed={...row('private-synthetic-reference'),revision:'3',updatedAt:'2026-02-30T18:00:00.000Z',origin:'private-synthetic-origin',timeZone:'private-synthetic-zone'};
 for(const item of [{location:'Fictional area',weeklyHours:12,schedule},malformed]){
  const f=fixture({fetchedAt:'2026-11-25',items:[item]});await f.load();
  assert.match(f.root.textContent,/Schedule checked: unavailable/);
  assert.match(f.root.textContent,/Last office change: unavailable/);
  assert.match(f.root.textContent,/Schedule version unavailable/);
  assert.match(f.root.textContent,/Assignment source unavailable/);
  assert.match(f.root.textContent,/time zone unavailable/);
  assert.doesNotMatch(f.root.textContent,/private-synthetic|live|verified work|paid hours/i);
  assert.ok(walk(f.root).filter(el=>el.className==='portal-task').every(card=>!card.attrs['data-assignment-ref']));
 }
});

test('a newly read revision changes the office update label while retaining the same assignment reference',async()=>{
 const first=fixture({fetchedAt:'2026-11-25T14:00:00.000Z',items:[row()]}),next=fixture({fetchedAt:'2026-11-25T14:10:00.000Z',items:[{...row(),revision:4,updatedAt:'2026-11-25T13:30:00.000Z'}]});
 await first.load();await next.load();
 const card=f=>walk(f.root).find(el=>el.className==='portal-task');
 assert.equal(card(first).attrs['data-assignment-ref'],'a'.repeat(64));
 assert.equal(card(next).attrs['data-assignment-ref'],card(first).attrs['data-assignment-ref']);
 assert.match(next.root.textContent,/Schedule version 4/);
 assert.match(next.root.textContent,/Last office change:.*7:30 AM.*CST/);
 assert.match(next.root.textContent,/Schedule checked:.*8:10 AM.*CST/);
});

test('an empty own-calendar reply keeps its read receipt and a late reply cannot reopen a departed view',async()=>{
 const empty=fixture({fetchedAt:'2026-11-25T14:00:00.000Z',items:[]});await empty.load();
 assert.match(empty.root.textContent,/Schedule checked:.*8:00 AM.*CST/);
 assert.match(empty.root.textContent,/no upcoming office-confirmed assignments/i);
 let resolve;const pending=new Promise(done=>{resolve=done;}),f=fixture(()=>pending),loading=f.load();f.close();resolve({fetchedAt:'2026-11-25T14:00:00.000Z',items:[row()]});await loading;
 assert.equal(f.root.textContent,'');assert.equal(f.root.children.length,0);assert.deepEqual(f.calls,['/application/schedule']);
});
