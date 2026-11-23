import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {minify} from 'terser';

// Keep editable sources while retaining the existing portal transfer budgets.
// Only local names and whitespace change; no compression or property renaming.
export const runtimeAssets=['account','application','board','personnel','forms','field-visits','staff','matching','office-tools','navigation','form-workflow','authorization-member','reauth','private-pdf','management'].map(name=>'workforce-'+name+'.js');
export async function buildWorkforceRuntime({root=process.cwd(),check=false}={}){
 for(const name of runtimeAssets){
  const source=await readFile(resolve(root,'source/workforce',name),'utf8');
  const result=await minify(source.replace(/\r\n?/g,'\n'),{compress:false,mangle:{toplevel:false},keep_fnames:true,keep_classnames:true,format:{comments:false}});
  const output=result.code+'\n',path=resolve(root,'public/assets',name);
  if(check){if(await readFile(path,'utf8')!==output)throw Error('Stale workforce runtime: '+name);}
  else await writeFile(path,output);
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){await buildWorkforceRuntime({check:process.argv.includes('--check')});console.log('WORKFORCE_RUNTIME: CURRENT');}
