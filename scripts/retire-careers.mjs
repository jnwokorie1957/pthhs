import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
// Retain inbound links with a redirect; Caregiver Portal is the only recruiting entry.
export function portalLinks(html){
 return html.replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi,nav=>{
   if(/href=["']\/caregiver(?:[?#][^"']*)?["']/.test(nav))return nav.replace(/<a\b[^>]*href=["'](?:https:\/\/pthhs.net)?\/home-care-careers(?:\.html)?\/?[^"']*["'][^>]*>[\s\S]*?<\/a>/gi,'');
   return nav;
 }).replace(/<a\b([^>]*?)href=(["'])(?:https:\/\/pthhs.net)?\/home-care-careers(?:\.html)?\/?(?:[?#][^"']*)?\2([^>]*)>([\s\S]*?)<\/a>/gi,(_all,before,quote,after,label)=>`<a${before}href=${quote}/caregiver${quote}${after}>${/^\s*(?:Careers|Apply Now|Apply Online)\s*$/i.test(label)?'Caregiver Portal':label}</a>`);
}
export const careersRedirect='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0;url=/caregiver"><link rel="canonical" href="https://pthhs.net/caregiver"><title>Caregiver Portal | Primetime</title></head><body><p>Applications are available in the <a href="/caregiver">Caregiver Portal</a>.</p></body></html>\n';
export const removeCareersFromSitemap=xml=>xml.replace(/<url>\s*<loc>https:\/\/pthhs.net\/home-care-careers(?:\.html)?\/?<\/loc>[\s\S]*?<\/url>/g,'').replace(/^[ \t]+$/gm,'');
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 let changed=0;function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(file.endsWith('.html')&&!file.endsWith('home-care-careers.html')){const before=fs.readFileSync(file,'utf8'),after=portalLinks(before);if(before!==after){fs.writeFileSync(file,after);changed++;}}}}walk('public');
 fs.writeFileSync('public/home-care-careers.html',careersRedirect);
 const sitemap='public/sitemap.xml';fs.writeFileSync(sitemap,removeCareersFromSitemap(fs.readFileSync(sitemap,'utf8')));
 const file='firebase.json',config=JSON.parse(fs.readFileSync(file));config.hosting.redirects=config.hosting.redirects.filter(r=>!['/home-care-careers','/home-care-careers.html','/home-care-careers/'].includes(r.source));config.hosting.redirects.unshift(...['/home-care-careers','/home-care-careers.html','/home-care-careers/'].map(source=>({source,destination:'/caregiver',type:301})));fs.writeFileSync(file,JSON.stringify(config,null,2)+'\n');
 console.log('Updated public recruiting links on '+changed+' pages.');
}
