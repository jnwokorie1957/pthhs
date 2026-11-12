import http from 'node:http';
import {readFile} from 'node:fs/promises';
const origin='https://us-central1-primetimehomehealthservices.cloudfunctions.net/workforceDocumentDecrypt';
const cache=new Map();
const server=http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');
 try{
  if(!/^localhost:4212$|^127\.0\.0\.1:4212$/.test(req.headers.host||'')){res.writeHead(403).end();return;}
  const route=new URL(req.url,'http://localhost').pathname;
  const api=route.match(/^\/api\/(request|verify|pdf)$/);
  if(api){
   if(req.headers.origin&&req.headers.origin!=='http://localhost:4212'){res.writeHead(403).end();return;}
   const body=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>1000){res.writeHead(413).end();return;}body.push(chunk);}
   const response=await fetch(origin+'/document-access/sample/'+api[1],{method:req.method,headers:{Authorization:req.headers.authorization||'','Content-Type':'application/json','X-Document-Access':req.headers['x-document-access']||''},...(req.method==='POST'?{body:Buffer.concat(body)}:{}),signal:AbortSignal.timeout(55000),redirect:'error'});
   res.writeHead(response.status,{'Content-Type':response.headers.get('content-type')||'application/json'});res.end(Buffer.from(await response.arrayBuffer()));return;
  }
  if(req.method!=='GET'){res.writeHead(405).end();return;}
  if(route==='/'){res.setHeader('Content-Type','text/html');res.end(await readFile(new URL('./secure-document-sample.html',import.meta.url)));return;}
  if(route==='/document-access.js'){res.setHeader('Content-Type','text/javascript');res.end(await readFile(new URL('../public/assets/workforce-document-access.js',import.meta.url)));return;}
  const url=route==='/config'?'https://primetimehomehealthservices.firebaseapp.com/__/firebase/init.json':/^\/firebase-(app|auth)-compat\.js$/.test(route)?'https://www.gstatic.com/firebasejs/13.2.0'+route:null;
  if(url){if(!cache.has(route)){const r=await fetch(url);if(!r.ok)throw Error();cache.set(route,await r.text());}res.setHeader('Content-Type',route==='/config'?'application/json':'text/javascript');res.end(cache.get(route));return;}
  res.writeHead(404).end();
 }catch{if(!res.headersSent)res.writeHead(503,{'Content-Type':'application/json'});res.end('{"error":"sample_unavailable"}');}
});
server.listen(4212,'127.0.0.1',()=>console.log('Secure document sample: http://localhost:4212/'));
