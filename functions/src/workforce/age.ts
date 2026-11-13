import {chicagoDate} from './dates.js';
export function isAdult(birthDate:string,at:string|Date):boolean {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)||!Number.isFinite(Date.parse(birthDate))||new Date(birthDate).toISOString().slice(0,10)!==birthDate)return false;
 const today=chicagoDate(at),year=Number(today.slice(0,4))-18;
 return birthDate<=String(year)+today.slice(4);
}
