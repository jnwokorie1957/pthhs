import {nameQuery,normalizeName} from './directory.js';
import {requirePermission,type Actor} from './policy.js';
// Names only. Cached source records never authorize account linking or file reads.
export function cachedHhaNames(actor:Actor,office:string,input:unknown,rows:Record<string,unknown>[],now=Date.now()){
 requirePermission(actor,'accounts.support',office);const query=nameQuery(input);
 const items=rows.filter(row=>row.office===office&&typeof row.id==='string'&&/^[1-9]\d{0,9}$/.test(row.id)&&typeof row.firstName==='string'&&typeof row.lastName==='string'&&typeof row.fetchedAt==='string'&&Number.isFinite(Date.parse(row.fetchedAt))&&now-Date.parse(row.fetchedAt)>=0&&now-Date.parse(row.fetchedAt)<36*3600000)
 .filter(row=>[row.firstName,row.lastName,row.firstName+' '+row.lastName].some(value=>normalizeName(String(value)).startsWith(query)))
 .map(row=>({uid:'hha-'+row.id,hhaId:row.id as string,source:'hhaexchange' as const,firstName:row.firstName as string,lastName:row.lastName as string,state:String(row.status||'Unknown'),code:String(row.code||''),office,fetchedAt:row.fetchedAt as string}));
 items.sort((a,b)=>(a.lastName+' '+a.firstName).localeCompare(b.lastName+' '+b.firstName));
 return {items:items.slice(0,8),hasMore:items.length>8||rows.length>=5001,source:'hhaexchange' as const};
}
