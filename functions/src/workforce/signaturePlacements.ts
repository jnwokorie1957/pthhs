import {type PDFDocument,type PDFPage,rgb} from 'pdf-lib';
import {styleSignature,type SignatureAppearance} from './signature.js';
import {WorkforceError} from './policy.js';
export type SignaturePlacement={role:'member'|'caregiver'|'staff';page:number;x:number;y:number;width:number;height:number};
export function signaturePlacements(input:unknown,pages:number,roles:readonly string[]):SignaturePlacement[]{
 if(input===undefined)return [];
 if(!Array.isArray(input)||input.length>60)throw new WorkforceError(400,'invalid_signature_fields');
 const result:SignaturePlacement[]=[];
 for(const row of input){
  if(!row||Object.keys(row).some(k=>!['role','page','x','y','width','height'].includes(k))||!roles.includes(row.role)||!Number.isSafeInteger(row.page)||row.page<0||row.page>=pages||['x','y','width','height'].some(k=>typeof row[k]!=='number'||!Number.isFinite(row[k]))||row.x<0||row.y<0||row.width<.08||row.height<.025||row.x+row.width>1||row.y+row.height>1)throw new WorkforceError(400,'invalid_signature_fields');
  if(result.some(a=>a.page===row.page&&a.x<row.x+row.width&&a.x+a.width>row.x&&a.y<row.y+row.height&&a.y+a.height>row.y))throw new WorkforceError(400,'signature_fields_overlap');
  result.push({role:row.role,page:row.page,x:row.x,y:row.y,width:row.width,height:row.height});
 }
 return result;
}
export async function placeSignatures(pdf:PDFDocument,page:PDFPage,fields:SignaturePlacement[],pageIndex:number,area:{x:number;y:number;width:number;height:number},signatures:Array<{role:string;name:string;appearance:SignatureAppearance}>){
 for(const[index,box]of fields.entries()){
  if(box.page!==pageIndex)continue;
  const signature=signatures.find(s=>s.role===box.role),x=area.x+box.x*area.width,y=area.y+(1-box.y-box.height)*area.height,width=box.width*area.width,height=box.height*area.height;
  if(signature){const field=pdf.getForm().createTextField('placed-signature-'+index);field.addToPage(page,{x,y,width,height,borderWidth:0});await styleSignature(pdf,field,signature.name,signature.appearance);}
  else{page.drawRectangle({x,y,width,height,borderWidth:1,borderColor:rgb(.3,.42,.44)});}
 }
}
