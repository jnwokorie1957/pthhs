export const EMPLOYER_NAME = "Primetime Home Health Services, Inc.";
export const EMPLOYER_ADDRESS = "11602 Burdine St # A, Houston, TX 77035";
export function chicagoDate(now: string | Date): string {
 const parts = new Intl.DateTimeFormat("en-US", {timeZone:"America/Chicago",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(now));
 const get = (type: string) => parts.find(p=>p.type===type)!.value;
 return `${get("year")}-${get("month")}-${get("day")}`;
}
