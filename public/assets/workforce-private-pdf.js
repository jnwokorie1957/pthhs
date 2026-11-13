(()=>{
 let generation=0;const urls=new Set(),tasks=new Set();
 window.WorkforcePrivatePdf={async show(target,blob,filename='document.pdf',current=()=>true){
  const token=generation;target.replaceChildren();const status=document.createElement('p');status.textContent='Preparing document preview…';target.append(status);
  const lib=await import('/assets/authorization-reader/pdf.mjs');lib.GlobalWorkerOptions.workerSrc='/assets/authorization-reader/pdf.worker.mjs';
  const task=lib.getDocument({data:new Uint8Array(await blob.arrayBuffer()),isEvalSupported:false,useWasm:false,disableFontFace:true});tasks.add(task);
  try{const pdf=await task.promise;if(token!==generation||!current())return;if(pdf.numPages>40)throw Error('This document is too long for the inline viewer.');const preview=document.createElement('div');preview.className='private-pdf-preview';target.append(preview);
   for(let n=1;n<=pdf.numPages;n++){if(token!==generation||!current())return;const page=await pdf.getPage(n),original=page.getViewport({scale:1}),viewport=page.getViewport({scale:Math.min(1.6,1200/Math.max(original.width,original.height))}),canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);canvas.setAttribute('aria-label','Document page '+n+' of '+pdf.numPages);await page.render({canvas,canvasContext:canvas.getContext('2d'),viewport}).promise;preview.append(canvas);page.cleanup();}
   if(token!==generation||!current())return;status.textContent=pdf.numPages+' document pages ready for review.';
   const download=document.createElement('a'),url=URL.createObjectURL(blob);urls.add(url);download.href=url;download.download=filename;download.textContent='Download PDF for printing';download.className='btn-secondary';const print=document.createElement('button');print.type='button';print.textContent='Print document';print.className='btn-secondary';print.onclick=()=>{preview.classList.add('private-pdf-printing');window.print();preview.classList.remove('private-pdf-printing');};target.prepend(download,print);return true;
  }finally{tasks.delete(task);await task.destroy();}
 }};
 document.addEventListener('workforce-session-cleared',()=>{generation++;for(const task of tasks)task.destroy();tasks.clear();for(const url of urls)URL.revokeObjectURL(url);urls.clear();document.querySelectorAll('.private-pdf-preview').forEach(e=>e.replaceChildren());});
})();
