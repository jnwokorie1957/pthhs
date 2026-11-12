import fs from 'node:fs';
const root='./',schemas=JSON.parse(fs.readFileSync(root+'public/assets/forms/schema.json','utf8'));
for(const kind of Object.keys(schemas)){
 if(kind==='new_hire'||kind==='cch')continue;
 const schema=schemas[kind];schema.fields.forEach((f,i)=>f.required=kind==='w4'?[0,1,2,3,4,5,6,7,9,10,11].includes(i):['Last Name (Family Name)','First Name Given Name','Address Street Number and Name','City or Town','State','ZIP Code','Date of Birth mmddyyyy'].includes(f.id));
 schema.employerFields=kind==='w4'?[
  {key:'companyAddress',label:'Employer name and address — automatically entered',rect:{x:94.6,y:35.968,width:293.45,height:30},multiline:true},
  {key:'firstDay',label:'First date of employment — office confirms',rect:{x:389.8,y:35.968,width:77.45,height:12}},
  {key:'ein',label:'Employer EIN — automatically entered',rect:{x:469,y:35.968,width:107,height:12}}
 ]:[
  {key:'name',label:'Employer company name — automatically entered',rect:{x:36.69,y:53.04,width:202.18,height:13.7}},
  {key:'address',label:'Employer address — automatically entered',rect:{x:245.82,y:53.04,width:329.16,height:13.7}}
 ];
}
const css=['.pdf-scroll{overflow:auto;margin:20px 0;border:1px solid #c7d5df}.pdf-stage{position:relative;min-width:760px}.pdf-stage .official-form-canvas{width:100%;margin:0;border:0}.pdf-field{position:absolute;display:block;margin:0;padding:0;line-height:1}.pdf-field>span{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}.pdf-field input,.pdf-field select,.pdf-field textarea{box-sizing:border-box;width:100%;height:100%;min-height:0;margin:0;padding:1px 3px;border:1px solid #3973a8;border-radius:2px;background:#f5faff;color:#142e47;font:clamp(9px,1.1vw,14px) Arial,sans-serif}.pdf-field input:is([type=checkbox],[type=radio]){appearance:auto;padding:0;accent-color:#13598d}.pdf-field input:read-only,.pdf-field textarea:read-only{background:#f2f5f7;border-color:#8a9ca9}.pdf-field input:focus{outline:2px solid #db9d16;outline-offset:0}.pdf-required{position:absolute;right:1px;top:-9px;color:#a71924;font-size:12px}.pdf-stage.guided-entry{min-width:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:18px;padding:18px}.guided-entry canvas{display:none!important}.guided-entry .pdf-field{position:static!important;display:flex;flex-direction:column;gap:8px;width:auto!important;height:auto!important}.guided-entry .pdf-field>span{position:static;width:auto;height:auto;clip-path:none;font-weight:600}.guided-entry .pdf-field input,.guided-entry .pdf-field select,.guided-entry .pdf-field textarea{min-height:42px;font-size:16px}.guided-entry .pdf-field input:is([type=checkbox],[type=radio]){width:22px;height:22px;min-height:22px}.guided-entry .pdf-required{display:none}'];
const position=(className,rect,page)=>{css.push(`.${className}{left:${rect.x/page.width*100}%;top:${(page.height-rect.y-rect.height)/page.height*100}%;width:${rect.width/page.width*100}%;height:${rect.height/page.height*100}%}`);};
for(const[k,s]of Object.entries(schemas)){
 s.fields.forEach((f,i)=>position(k+'-field-'+i,f.rect,s.pages[f.page-1]));
 for(const f of s.employerFields||[])position(k+'-employer-'+f.key,f.rect,s.pages[0]);
 if(k==='cch'){
  position('cch-signature',s.signatureRect,s.pages[0]);
  position('cch-signature-date',s.signatureDateRect,s.pages[0]);
 }else if(k==='w4'){
  [{x:94.6,y:635.966,width:265,height:14},{x:361.6,y:635.966,width:44,height:14},{x:407.6,y:635.966,width:66.85,height:14}].forEach((r,i)=>position('w4-city-'+i,r,s.pages[0]));
  position('w4-signature',{x:100,y:93,width:345,height:19},s.pages[0]);position('w4-signature-date',{x:462,y:93,width:114,height:19},s.pages[0]);
 }else if(k==='i9'){position('i9-signature',{x:42.076,y:420.8,width:323.204,height:12.918},s.pages[0]);position('i9-signature-date',{x:372.444,y:420.804,width:101.676,height:12.917},s.pages[0]);}
}
css.push('#portal-form-editor .pdf-field{display:block;margin:0;padding:0;line-height:1}#portal-form-editor .pdf-field input,#portal-form-editor .pdf-field select,#portal-form-editor .pdf-field textarea{box-sizing:border-box;width:100%;height:100%;min-height:0;line-height:1;margin:0;padding:1px 3px;border:1px solid #3973a8;border-radius:2px;font:clamp(9px,1.1vw,14px) Arial,sans-serif}#portal-form-editor .pdf-field input:is([type=checkbox],[type=radio]){width:100%;height:100%;min-height:0;padding:0;appearance:auto;display:block}#portal-form-editor .guided-entry .pdf-field{display:flex}#portal-form-editor .guided-entry .pdf-field input,#portal-form-editor .guided-entry .pdf-field select,#portal-form-editor .guided-entry .pdf-field textarea{min-height:42px;font-size:16px}#portal-form-editor .guided-entry .pdf-field input:is([type=checkbox],[type=radio]){width:22px;height:22px;min-height:22px}');
const json=JSON.stringify(schemas,null,2)+'\n';
for(const [file,expected]of [['public/assets/forms/schema.json',json],['functions/assets/workforce-forms/schema.json',json],['public/assets/workforce-form-layout.css',css.join('\n')+'\n']]){
 if(process.argv.includes('--check')){if(fs.readFileSync(file,'utf8')!==expected)throw Error('Stale form layout: '+file);}
 else fs.writeFileSync(file,expected);
}
console.log('WORKFORCE_FORM_LAYOUT: CURRENT');
