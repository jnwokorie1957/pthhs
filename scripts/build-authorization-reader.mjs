import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const modules=path.resolve(process.argv[2]||'node_modules'),target=path.resolve('public/assets/authorization-reader');
fs.mkdirSync(target,{recursive:true});const manifest=[];
function copy(pkg,from,to=path.basename(from)) {const source=path.join(modules,pkg,from),bytes=fs.readFileSync(source);fs.writeFileSync(path.join(target,to),bytes);manifest.push({file:to,package:pkg,sha256:createHash('sha256').update(bytes).digest('hex')});}
for(const file of ['pdf.mjs','pdf.worker.mjs'])copy('pdfjs-dist','build/'+file);
copy('pdfjs-dist','LICENSE','pdfjs-LICENSE');
for(const file of ['tesseract.esm.min.js','worker.min.js'])copy('tesseract.js','dist/'+file);
copy('tesseract.js','LICENSE.md','tesseract-LICENSE');
for(const file of fs.readdirSync(path.join(modules,'tesseract.js-core')).filter(f=>f.endsWith('.wasm.js')))copy('tesseract.js-core',file);
copy('tesseract.js-core','LICENSE','tesseract-core-LICENSE');
copy('@tesseract.js-data/eng','4.0.0/eng.traineddata.gz');
fs.writeFileSync(path.join(target,'manifest.json'),JSON.stringify({packages:Object.fromEntries(['pdfjs-dist','tesseract.js','tesseract.js-core','@tesseract.js-data/eng'].map(pkg=>[pkg,JSON.parse(fs.readFileSync(path.join(modules,pkg,'package.json'),'utf8')).version])),files:manifest},null,2)+'\n');
console.log('Bundled '+manifest.length+' authorization reader assets.');
