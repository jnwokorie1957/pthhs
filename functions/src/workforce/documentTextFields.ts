import {StandardFonts,type PDFDocument,type PDFPage,type PDFFont,rgb} from 'pdf-lib';
import {signaturePlacements} from './signaturePlacements.js';
import {WorkforceError} from './policy.js';
export type DocumentTextField={id:string;label:string;source:'clientName'|'memberId'|'caregiverName'|'visitDate'|'manual';required:boolean;page:number;x:number;y:number;width:number;height:number};
export function documentTextFields(input:unknown,pages:number):DocumentTextField[]{
 if(input===undefined)return [];if(!Array.isArray(input)||input.length>60)throw new WorkforceError(400,'invalid_document_fields');
 const ids=new Set<string>();const fields:DocumentTextField[]=input.map(row=>{if(!row||Object.keys(row).some(key=>!['id','label','source','required','page','x','y','width','height'].includes(key))||typeof row.id!=='string'||!/^text_[a-zA-Z0-9_-]{1,40}$/.test(row.id)||ids.has(row.id)||typeof row.label!=='string'||!row.label.trim()||row.label.length>160||!['clientName','memberId','caregiverName','visitDate','manual'].includes(row.source)||typeof row.required!=='boolean')throw new WorkforceError(400,'invalid_document_fields');ids.add(row.id);return {...row,label:row.label.trim()};});
 signaturePlacements(fields.map(({page,x,y,width,height})=>({role:'member',page,x,y,width,height})),pages,['member'],{width:.04,height:.015});return fields;
}
export function documentFieldValue(field:DocumentTextField,data:{clientName:string;memberId:string;caregiverName:string;visitDate:string;fields:Record<string,string>}){if(field.source==='manual')return data.fields[field.id]||'';if(field.source==='visitDate'){const [year,month,day]=data.visitDate.split('-');return month+'/'+day+'/'+year;}return data[field.source];}
function lines(text:string,font:PDFFont,size:number,width:number){const result:string[]=[];for(const paragraph of text.split(/\r?\n/)){let line='';for(const char of paragraph){if(font.widthOfTextAtSize(line+char,size)>width&&line){result.push(line);line='';}line+=char;}result.push(line);}return result;}
export async function placeDocumentText(pdf:PDFDocument,page:PDFPage,fields:DocumentTextField[],pageIndex:number,area:{x:number;y:number;width:number;height:number},data:Parameters<typeof documentFieldValue>[1]){
 const font=await pdf.embedFont(StandardFonts.Helvetica);for(const field of fields){if(field.page!==pageIndex)continue;const text=documentFieldValue(field,data);if(!text)continue;const x=area.x+field.x*area.width,y=area.y+(1-field.y-field.height)*area.height,width=field.width*area.width-2,height=field.height*area.height-2;let size=11,wrapped:string[]=[];
  try{for(;size>=6;size--){wrapped=lines(text,font,size,width);if(wrapped.length*size*1.2<=height)break;}}catch{throw new WorkforceError(400,'document_text_unsupported');}
  if(size<6)throw new WorkforceError(400,'document_text_overflow');for(const[index,line]of wrapped.entries())page.drawText(line,{x:x+2,y:y+height-size-index*size*1.2+2,font,size,color:rgb(.05,.15,.17)});
 }
}
