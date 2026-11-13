import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../public/assets/workforce-hha-records.js',import.meta.url),'utf8');
function setup(options={}){
 const listeners=new Map(),roots=[];
 const make=tag=>({tagName:tag.toUpperCase(),children:[],dataset:{},attrs:{},textContent:'',append(...children){this.children.push(...children);},replaceChildren(...children){this.children=children;},setAttribute(key,value){this.attrs[key]=value;}});
 const window={},document={createElement:make,addEventListener:(name,fn)=>listeners.set(name,fn),querySelectorAll:()=>roots};
 vm.runInNewContext(source,{window,document,Date,Object,String,Array,Error});
 const target=make('section'),calls=[],api=options.api||(async path=>{calls.push(path);return {kind:path.split('/').at(-1),source:'hhaexchange',items:[],truncated:false};});
 const root=window.WorkforceHhaRecords.mount(target,{api,...options});roots.push(root);
 const all=el=>[el,...el.children.flatMap(all)],buttons=()=>all(root).filter(el=>el.tagName==='BUTTON'),text=()=>all(root).map(el=>el.textContent).join(' ');
 return {root,buttons,text,calls,clear:()=>listeners.get('workforce-session-cleared')()};
}
test('self views load only on request and staff cannot request pay rates',async()=>{const s=setup();assert.equal(s.calls.length,0);assert.equal(s.buttons().length,5);await s.buttons()[0].onclick();assert.deepEqual(s.calls,['/application/hha-records/weekly-availability']);const staff=setup({self:false,base:'/staff/roster/101/records/'});assert.equal(staff.buttons().length,4);assert.doesNotMatch(staff.text(),/My pay rates/);assert.match(staff.text(),/separate Operations sign-in/);});
test('connection pending, empty, partial and absent fields stay distinct',async()=>{let mode='pending';const s=setup({api:async()=>{if(mode==='pending')throw Error('hha_record_connection_pending');return {kind:'weekly-availability',source:'hhaexchange',items:mode==='empty'?[]:[{MondayFrom:null,MondayTo:'',MondayLiveIn:'0'}],truncated:mode==='partial'};}});const button=s.buttons()[0];await button.onclick();assert.match(s.text(),/awaiting office enablement/);mode='empty';await button.onclick();assert.match(s.text(),/returned no records/);mode='partial';await button.onclick();assert.match(s.text(),/Partial results/);assert.match(s.text(),/Not supplied/);assert.match(s.text(),/Empty in HHA/);assert.match(s.text(),/0/);});
test('a late response after sign-out cannot restore work records',async()=>{let finish;const s=setup({api:()=>new Promise(resolve=>finish=resolve)}),pending=s.buttons()[0].onclick();s.clear();finish({kind:'weekly-availability',source:'hhaexchange',items:[{MondayFrom:'PRIVATE'}]});await pending;assert.equal(s.root.children.length,0);assert.doesNotMatch(s.text(),/PRIVATE/);});
test('record navigation changes suppress late results and duplicate clicks',async()=>{let finish,current=true,count=0;const s=setup({current:()=>current,api:()=>{count++;return new Promise(resolve=>finish=resolve);}}),button=s.buttons()[0],pending=button.onclick();await button.onclick();assert.equal(count,1);current=false;finish({kind:'weekly-availability',source:'hhaexchange',items:[{MondayFrom:'PRIVATE'}]});await pending;assert.doesNotMatch(s.text(),/PRIVATE/);});
