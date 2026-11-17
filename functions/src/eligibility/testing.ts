import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {EligibilityStore} from './store.js';
// Transactional test double. It serializes commits, rejects reads after writes,
// and rolls back aborted transactions. It does not replace emulator/IAM testing.
export function memory(auth?:any,clock:()=>number=Date.now){
  const records=new Map<string,any>();let serial=Promise.resolve();
  const ref=(path:string):any=>({path,id:path.split('/').at(-1),get:async()=>snapshot(path),
    set:async(value:any,options?:any)=>records.set(path,options?.merge?{...records.get(path),...structuredClone(value)}:structuredClone(value)),
    update:async(value:any)=>records.set(path,{...records.get(path),...structuredClone(value)})});
  const snapshot=(path:string)=>({exists:records.has(path),id:path.split('/').at(-1)!,ref:ref(path),data:()=>structuredClone(records.get(path))});
  const collection=(path:string,filters:any[]=[],order:any[]=[],take=Infinity,after=''):any=>({
    doc:(id=randomUUID())=>ref(path+'/'+id),add:async(value:any)=>ref(path+'/'+randomUUID()).set(value),
    where:(field:string,op:string,value:any)=>collection(path,[...filters,[field,op,value]],order,take,after),
    orderBy:(field:any,direction='ASCENDING')=>collection(path,filters,[...order,[typeof field==='string'?field:'__name__',direction]],take,after),
    limit:(n:number)=>collection(path,filters,order,n,after),startAfter:(id:string)=>collection(path,filters,order,take,id),
    get:async()=>{let entries=[...records].filter(([key,data])=>key.startsWith(path+'/')&&key.split('/').length===2&&filters.every(([field,op,value])=>
      op==='=='?data[field]===value:op==='<='?data[field]<=value:op==='in'?value.includes(data[field]):op==='array-contains'?data[field]?.includes(value):false)&&(!after||key.split('/')[1]!>after));
      for(const [field,direction]of [...order].reverse())entries.sort((a,b)=>{const aa=field==='__name__'?a[0]:a[1][field],bb=field==='__name__'?b[0]:b[1][field];return (aa<bb?-1:aa>bb?1:0)*(direction.toLowerCase()==='desc'||direction==='DESCENDING'?-1:1);});
      const docs=entries.slice(0,take).map(([key])=>snapshot(key));return {docs,size:docs.length};},
  });
  const db={collection,getAll:async(...refs:any[])=>refs.map(ref=>snapshot(ref.path)),runTransaction:(fn:any)=>{const result=serial.then(async()=>{const writes:Array<()=>void>=[];
    const get=async(ref:any)=>{assert.equal(writes.length,0,'Firestore requires reads before writes');return ref.path?snapshot(ref.path):ref.get();};
    const value=await fn({get,getAll:async(...refs:any[])=>Promise.all(refs.map(get)),
      set:(ref:any,data:any,options?:any)=>writes.push(()=>records.set(ref.path,options?.merge?{...records.get(ref.path),...structuredClone(data)}:structuredClone(data))),
      create:(ref:any,data:any)=>writes.push(()=>{assert.ok(!records.has(ref.path));records.set(ref.path,structuredClone(data));}),
      update:(ref:any,data:any)=>writes.push(()=>{assert.ok(records.has(ref.path));records.set(ref.path,{...records.get(ref.path),...structuredClone(data)});})});
    writes.forEach(write=>write());return value;});serial=result.then(()=>{},()=>{});return result;}};
  return {records,store:new EligibilityStore(db as any,auth??(()=>{throw Error('Unexpected auth lookup');}),clock)};
}
