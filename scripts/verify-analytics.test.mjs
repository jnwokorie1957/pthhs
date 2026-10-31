import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../public/assets/analytics.js',import.meta.url),'utf8');
function run(overrides={}){
 const listeners={},scripts=[];
 const context={URL,Date,Element:class{},location:{hostname:'pthhs.net',origin:'https://pthhs.net',pathname:'/home-care-services',href:'https://pthhs.net/home-care-services?email=private@example.test#patient'},navigator:{},window:{},document:{title:'Public services',referrer:'https://search.example.test/?q=private@example.test',querySelector:q=>q.includes('canonical')?{href:'https://pthhs.net/home-care-services'}:null,createElement:()=>({}),head:{append:s=>scripts.push(s)},addEventListener:(name,fn)=>listeners[name]=fn},...overrides};
 vm.runInNewContext(source,context);return{...context,scripts,listeners};
}
test('public tracking strips URL query, fragment and referrer search and disables advertising',()=>{
 const c=run();assert.equal(c.scripts.length,1);const commands=c.window.dataLayer.map(x=>Array.from(x));
 const config=commands.find(x=>x[0]==='config')[2];assert.equal(config.page_location,'https://pthhs.net/home-care-services');assert.equal(config.page_referrer,'https://search.example.test/');assert.equal(config.allow_google_signals,false);assert.equal(config.allow_ad_personalization_signals,false);
 assert.equal(JSON.stringify(commands).includes('private@example.test'),false);assert.equal(commands[0][2].ad_storage,'denied');
});
test('internal operations, unknown hosts, privacy signals and noindex pages never load a tag',()=>{
 for(const overrides of [{location:{hostname:'pthhs.net',pathname:'/primetime'}},{location:{hostname:'preview.web.app',pathname:'/'}},{navigator:{globalPrivacyControl:true}},{navigator:{doNotTrack:'1'}},{document:{querySelector:()=>({content:'noindex,nofollow'})}}])assert.equal(run(overrides).scripts.length,0);
});
test('contact tracking sends intent without destination or link text',()=>{
 const c=run();const target=new c.Element();target.closest=()=>({getAttribute:()=> 'mailto:private@example.test?body=private-health-details'});
 c.listeners.click({target});const last=c.window.dataLayer.at(-1);assert.equal(last[1],'email_click');assert.equal(JSON.stringify(Array.from(last)).includes('private'),false);
});
