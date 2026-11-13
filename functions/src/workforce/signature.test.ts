import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument,PDFName} from 'pdf-lib';
import {signatureAppearance,signatureDigest,styleSignature} from './signature.js';
test('signature strokes are bounded and malformed payloads rejected',()=>{
 assert.deepEqual(signatureAppearance(undefined),{style:'cursive'});
 const drawn={style:'drawn',strokes:[[[0,.5],[.5,.1],[1,.8]]]};assert.deepEqual(signatureAppearance(drawn),drawn);assert.equal(signatureDigest(signatureAppearance(drawn)).length,64);
 for(const invalid of [null,{style:'printed'},{style:'cursive',extra:true},{style:'drawn',strokes:[]},{style:'drawn',strokes:[[[0,0]]]},{style:'drawn',strokes:[[[0,0],[2,0]]]},{style:'drawn',strokes:[Array(1601).fill([0,0])]}])assert.throws(()=>signatureAppearance(invalid),/invalid_signature/);
});
test('cursive and drawn PDFs retain canonical signer text, readonly state, and appearance streams',async()=>{
 for(const appearance of [signatureAppearance(undefined),signatureAppearance({style:'drawn',strokes:[[[0,.5],[.5,.1],[1,.8]]]})]){
  const doc=await PDFDocument.create(),page=doc.addPage(),field=doc.getForm().createTextField('Signature');field.addToPage(page,{x:20,y:20,width:300,height:24});await styleSignature(doc,field,'Jordan Taylor',appearance);
  const saved=await PDFDocument.load(await doc.save()),result=saved.getForm().getTextField('Signature');assert.equal(result.getText(),'Jordan Taylor');assert.equal(result.isReadOnly(),true);assert.ok(result.acroField.getWidgets()[0]!.dict.get(PDFName.of('AP')));
 }
});
