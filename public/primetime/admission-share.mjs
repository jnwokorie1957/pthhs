export async function prepareMessage({channel,id,actions,feedback,valid}){
 const node=(tag,text,cls)=>{const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;};
    if(!valid())return;for(const b of actions.children)b.disabled=true;feedback.replaceChildren(node('p','Preparing private link…'));
    try{const share=await workforceApi('/staff/admission-packets/'+id+'/share',{channel});if(!valid())return;
     const link=new URL('/primetime/admission-copy',location.origin);link.hash=share.token;
     const body='Your completed admission documents are ready. Open this link and enter the code provided by the office. '+link.href;
     const a=node('a',channel==='sms'?'Open text message':'Open email draft','btn-secondary');
     a.href=channel==='sms'?'sms:?body='+encodeURIComponent(body):'mailto:?subject=Your%20requested%20documents&body='+encodeURIComponent(body);
     feedback.replaceChildren(node('p','Give the recipient this code separately: '+share.code+'. The link expires '+new Date(share.expiresAt).toLocaleString()+'.'),a);
     const fallback=node('details','');fallback.append(node('summary','Use another messaging app'));
     const label=node('label','Private link to send to the recipient'),address=node('input','');address.readOnly=true;address.value=link.href;address.onfocus=()=>address.select();label.append(address);fallback.append(label);feedback.append(fallback);
    }catch(e){if(valid())feedback.textContent='Could not prepare the link. '+e.message;}finally{if(valid())for(const b of actions.children)b.disabled=false;}

}
