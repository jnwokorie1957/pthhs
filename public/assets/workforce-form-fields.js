(() => {
 const node=(tag,value)=>{const el=document.createElement(tag);el.textContent=value;return el;};
 window.WorkforceFormFields={render({target,schema,kind,pageNumber,fields,employer,fullName,readOnly,onChange}){
  const add=(id,label,type,value,className,change,required=false,options=[])=>{
   const wrapper=document.createElement('label');wrapper.className='pdf-field '+className;
   wrapper.append(node('span',label+(required?' *':'')));if(required){const star=node('b','*');star.className='pdf-required';star.setAttribute('aria-hidden','true');wrapper.append(star);}
   const input=document.createElement(type==='select'?'select':type==='multiline'?'textarea':'input');input.id=id;
   if(type==='select')for(const option of ['',...options]){const el=node('option',option||'Select');el.value=option;input.append(el);}
   else if(type!=='multiline')input.type=type==='checkbox'?'checkbox':type==='ssn'?'password':'text';
   if(type==='checkbox')input.checked=value===true;else input.value=String(value??'');
   input.autocomplete='off';input.setAttribute('aria-required',String(required));
   if(type!=='checkbox'&&type!=='select')input.maxLength=250;
   if(!change)input.readOnly=true;else input.disabled=readOnly;
   if(change)input.oninput=()=>change(type==='checkbox'?input.checked:input.value);
   if(type==='ssn'){
    let raw=String(value??'');const mask=()=>{const digits=raw.replace(/\D/g,'');input.type=digits.length===9?'text':'password';input.value=digits.length===9?'***-**-'+digits.slice(-4):raw;};
    input.onfocus=()=>{input.type='password';input.value=raw;input.select();};input.onblur=mask;input.oninput=()=>{raw=input.value;change?.(raw);};mask();
   }
   wrapper.append(input);target.append(wrapper);return input;
  };
  for(const [index,field]of schema.fields.entries()){
   if(field.page!==pageNumber)continue;
   if(kind==='w4'&&index===3){
    const match=String(fields[field.id]||'').match(/^(.*),\s*([A-Z]{2})\s*,?\s*(\d{5}(?:-\d{4})?)$/),parts=match?match.slice(1):['','',''];
    for(const [i,label]of ['City or town','State','ZIP code'].entries()){const input=add('official-city-'+i,'W-4 '+label,'text',parts[i],'w4-city-'+i,value=>{parts[i]=i===1?value.toUpperCase():value;onChange(field.id,parts[0]+', '+parts[1]+' '+parts[2]);},true);input.maxLength=i===1?2:i===2?10:100;}
    continue;
   }
   const exempt=kind==='w4'&&index>=5&&index<=14&&fields[schema.fields[15].id]===true;
   const required=field.required===true&&!exempt;
   const input=add('official-'+index,field.label,field.sensitive?'ssn':field.type,fields[field.id],kind+'-field-'+index,value=>onChange(field.id,value),required,field.options);
   input.maxLength=field.sensitive?11:field.maxLength;
   if(exempt)input.disabled=true;
   if(kind==='w4'&&index>=9&&index<=14){input.inputMode='decimal';input.placeholder='0 if none';}
  }
  if(pageNumber===1){
   if(kind==='w4'||kind==='i9'){
    add('official-signature-name','Employee signature','text',fullName,kind+'-signature',()=>{},true);
    add('official-signature-date','Signature date — recorded when signed','text',employer.signingDate,kind+'-signature-date',null);
   }
   for(const field of schema.employerFields||[])add('official-employer-'+field.key,field.label,field.multiline?'multiline':'text',employer[field.key]||'',kind+'-employer-'+field.key,null);
  }
 }};
})();
