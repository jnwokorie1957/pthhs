import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PDFDocument,PDFTextField,drawLine,rgb} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {WorkforceError} from './policy.js';
export type SignatureAppearance={style:'cursive'}|{style:'drawn';strokes:number[][][]};
export function signatureAppearance(value:unknown):SignatureAppearance {
 if(value===undefined)return {style:'cursive'};
 if(!value||typeof value!=='object'||Array.isArray(value))throw new WorkforceError(400,'invalid_signature');
 const v=value as {style?:unknown;strokes?:unknown};
 if(v.style==='cursive'&&Object.keys(v).length===1)return {style:'cursive'};
 if(v.style!=='drawn'||Object.keys(v).some(k=>!['style','strokes'].includes(k))||!Array.isArray(v.strokes)||!v.strokes.length||v.strokes.length>80)throw new WorkforceError(400,'invalid_signature');
 let points=0;
 for(const stroke of v.strokes){if(!Array.isArray(stroke)||stroke.length<2)throw new WorkforceError(400,'invalid_signature');for(const p of stroke){if(!Array.isArray(p)||p.length!==2||p.some(n=>typeof n!=='number'||!Number.isFinite(n)||n<0||n>1)||++points>1600)throw new WorkforceError(400,'invalid_signature');}}
 return {style:'drawn',strokes:v.strokes as number[][][]};
}
export function signatureDigest(value:SignatureAppearance){return createHash('sha256').update(JSON.stringify(value)).digest('hex');}
let fontBytes:Promise<Buffer>|undefined;
export async function styleSignature(doc:PDFDocument,field:PDFTextField,name:string,appearance?:SignatureAppearance){
 field.setText(name);field.enableReadOnly();
 if(!appearance)return;
 doc.registerFontkit(fontkit);
 // Embed the full font: subsetting Allura loses connected glyphs in PDF viewers.
 const font=await doc.embedFont(await(fontBytes??=readFile(new URL('../../assets/workforce-forms/Allura-Regular.ttf',import.meta.url))));
 const rect=field.acroField.getWidgets()[0]!.getRectangle();
 field.setFontSize(Math.max(7,Math.min(22,rect.height-1,(rect.width-4)/Math.max(1,font.widthOfTextAtSize(name,1)))));
 if(appearance.style==='cursive')field.updateAppearances(font);
 else field.updateAppearances(font,(_field,widget)=>{const r=widget.getRectangle();return appearance.strokes.flatMap(stroke=>stroke.slice(1).flatMap((p,i)=>drawLine({start:{x:2+stroke[i]![0]!*(r.width-4),y:2+(1-stroke[i]![1]!)*(r.height-4)},end:{x:2+p[0]!*(r.width-4),y:2+(1-p[1]!)*(r.height-4)},thickness:1,color:rgb(.04,.08,.16)})));});
}
