import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';import {test} from 'node:test';
for(const [family,label] of [['document-replacements','replacement'],['document-creations','creation'],['caregiver-pictures','picture']]) for(const action of ['review','execute']) test(`${family} ${action} never crosses a session while reading a file`,async()=>{
const elements=new Map(),events=new Map();
function node(id=''){return {id,children:[],handlers:new Map(),options:[],value:'',hidden:id==='appShell',dataset:{},classList:{add(){},remove(){},toggle(){}},addEventListener(event,fn){this.handlers.set(event,fn)},append(...items){this.children.push(...items)},replaceChildren(...items){this.children=items},querySelectorAll(){return []},querySelector(){return null},closest(){return {hidden:false}},reset(){this.value=''},focus(){},setAttribute(){},remove(){}}}
const element=id=>{if(!elements.has(id))elements.set(id,node(id));return elements.get(id)};
let reader,session='old-reviewer-session';const sent=[];
const change={id:'approved-file',revision:3,state:action==='review'?'pending_review':'approved',userRole:'Patient',subjectId:'8',documentId:'9',operation:'ChangePatientDocument',requestedBy:'requester',reviewedBy:'reviewer',before:{FileName:'old.txt',FileBytes:'3',FileSHA256:'old'},proposed:{FileName:'new.txt',FileBytes:'3',FileSHA256:'new'},retainedOriginalReference:'synthetic-archive',rationale:'synthetic',sourceCheck:'unchanged'};
const settings={settings:{officeId:'123',officeTimezone:'America/Chicago',policyReference:'synthetic',enabledReads:[]},dataApproved:true,supportedReads:[],documentReplacementWrites:['ChangePatientDocument'],documentCreationWrites:['AddPatientDocument'],caregiverPictureWritesEnabled:true};
const document={getElementById:element,querySelectorAll:()=>[],createElement:()=>node(),createTextNode:text=>({textContent:text}),addEventListener(event,fn){events.set(event,fn)}};
const window={confirm:()=>true,async primetimeApiFetch(path,options){sent.push({path,session,body:options?.body});const result=path.endsWith('/settings')?settings:path.endsWith('/'+family)?{changes:[change]}:{};return {ok:true,json:async()=>({ok:true,...result})}}};
vm.runInNewContext(readFileSync(new URL('../public/primetime/workspace.js',import.meta.url),'utf8'),{document,window,crypto:{randomUUID:()=> 'synthetic'},FileReader:class {readAsDataURL(){reader=this}},console});
const tick=()=>new Promise(resolve=>setImmediate(resolve));events.get('primetime-ready')();await tick();
element(family==='caregiver-pictures'?'loadCaregiverPictures':family==='document-creations'?'loadDocumentCreations':'loadDocumentReplacements').handlers.get('click')();await tick();
const flatten=e=>[e,...e.children.flatMap(child=>child.children?flatten(child):[])];const nodes=flatten(element(family==='caregiver-pictures'?'caregiverPictureChanges':family==='document-creations'?'documentCreationChanges':'documentReplacementChanges'));const file=nodes.find(n=>n.type==='file');file.files=[{name:'new.txt',size:3}];const submit=nodes.find(n=>n.textContent===(family==='caregiver-pictures'?(action==='review'?'Caregiver picture approved':'Submit caregiver picture change once'):(action==='review'?'Attachment '+label+' approved':'Submit attachment '+label+' change once')));assert.ok(submit);
const pending=submit.handlers.get('click')();assert.ok(reader);events.get('primetime-signed-out')();session='new-reviewer-session';events.get('primetime-ready')();await tick();
reader.result='data:application/octet-stream;base64,bmV3';reader.onload();await pending;await tick();

assert.equal(sent.filter(item=>item.path.endsWith('/'+family+'/'+action)).length,0);
});
