import fs from 'node:fs';
import path from 'node:path';
// Vendor only the pinned PDF.js renderer/worker; no CDN, scripting, XFA or
// generic viewer application. These generated files are excluded from Git.
const out=path.resolve('public/assets/form-viewer');fs.mkdirSync(out,{recursive:true});
for(const [source,target]of [['build/pdf.mjs','pdf.mjs'],['build/pdf.worker.mjs','pdf.worker.mjs'],['LICENSE','PDFJS-LICENSE.txt']]){
 const expected=fs.readFileSync(path.resolve('node_modules/pdfjs-dist',source)),file=path.join(out,target);
 if(process.argv.includes('--check')){if(!fs.existsSync(file)||!expected.equals(fs.readFileSync(file)))throw Error('Stale PDF.js asset: '+target);}
 else fs.writeFileSync(file,expected);
}
console.log('WORKFORCE_FORM_VIEWER: CURRENT');
