import {nameQuery,normalizeName} from './directory.js';
import {requirePermission,type Actor} from './policy.js';
export const ACTIVE_HHA_CAREGIVER_STATUS = 'Active';
// Names only. Cached source records never authorize account linking or file reads.
export function cachedHhaName(office: string, row: Record<string, unknown>, now: number) {
 const {id, firstName, lastName, fetchedAt} = row;
 if (row.office !== office || row.status !== ACTIVE_HHA_CAREGIVER_STATUS || typeof id !== 'string' || !/^[1-9]\d{0,9}$/.test(id)
  || typeof firstName !== 'string' || typeof lastName !== 'string' || typeof fetchedAt !== 'string') return null;
 const age = now - Date.parse(fetchedAt);
 if (!Number.isFinite(age) || age < 0 || age >= 36 * 3600000) return null;
 return {uid:'hha-'+id,hhaId:id,source:'hhaexchange' as const,firstName,lastName,state:ACTIVE_HHA_CAREGIVER_STATUS,code:String(row.code||''),office,fetchedAt};
}
export function cachedHhaNames(actor:Actor,office:string,input:unknown,rows:Record<string,unknown>[],now=Date.now()){
 requirePermission(actor,'accounts.support',office);const query=nameQuery(input);
 const items=rows.map(row=>cachedHhaName(office,row,now)).filter(row=>row!==null)
 .filter(row=>[row.firstName,row.lastName,row.firstName+' '+row.lastName].some(value=>normalizeName(value).startsWith(query)));
 items.sort((a,b)=>(a.lastName+' '+a.firstName).localeCompare(b.lastName+' '+b.firstName));
 return {items:items.slice(0,8),hasMore:items.length>8||rows.length>=5001,source:'hhaexchange' as const};
}
