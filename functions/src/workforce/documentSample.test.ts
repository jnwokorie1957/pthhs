import test from "node:test";
import assert from "node:assert/strict";
import {DocumentSample} from "./documentSample.js";
import {DocumentVerificationMail} from "./verificationMail.js";
import {EnvelopeDocumentCipher} from "./documentEncryption.js";

test("the synthetic acceptance flow stores ciphertext and needs the emailed code plus current authorization to release a PDF", async () => {
  const records = new Map<string, any>(); let serial = Promise.resolve();
  const ref = (path: string) => ({path, get: async () => ({data: () => structuredClone(records.get(path))}),
    create: async (v: any) => {assert(!records.has(path));records.set(path, structuredClone(v));},
    update: async (v: any) => {records.set(path, {...records.get(path), ...v});}});
  const db: any = {collection: (name: string) => ({doc: (id: string) => ref(name+"/"+id)}), runTransaction: (fn: any) => {
    const task = serial.then(async()=>{
      const writes: [string,any][]=[];
      const value=await fn({get:(r:any)=>r.get(),set:(r:any,v:any)=>writes.push([r.path,v]),create:(r:any,v:any)=>writes.push([r.path,v]),update:(r:any,v:any)=>writes.push([r.path,{...records.get(r.path),...v}])});
      for(const [path,data]of writes)records.set(path,structuredClone(data));return value;
    });serial=task.then(()=>{},()=>{});return task;
  }};
  let code = "", allowed = true, decrypts = 0;
  const check = async () => {if (!allowed) throw Error("role_revoked");};
  const transport = {prepare: async () => async (mail: any) => {code = mail.code;}};
  const cipher = new EnvelopeDocumentCipher("synthetic-key", {wrap:async key=>Buffer.from(key),unwrap:async key=>{decrypts++;return Buffer.from(key);}});
  const sample = new DocumentSample(new DocumentVerificationMail(transport,db),db,cipher);
  const principal = {uid:"synthetic-owner",email:"owner@example.invalid",authTime:1};
  const challenge = await sample.request(principal,check);
  const artifact = records.get("workforceDocumentSamples/"+challenge.challengeId);
  assert(!Buffer.from(artifact.bytes,"base64").includes(Buffer.from("%PDF-")));
  assert.equal(records.get("workforceIdentityMail/verify-"+challenge.challengeId).message,null);
  await assert.rejects(sample.verify(principal,challenge.challengeId,code==='000000'?'000001':'000000',check),/invalid_document_code/);
  const proof = await sample.verify(principal,challenge.challengeId,code,check);
  allowed=false; await assert.rejects(sample.open(principal,proof.accessToken,check),/role_revoked/);assert.equal(decrypts,0);
  allowed=true;const pdf=await sample.open(principal,proof.accessToken,check);
  assert.equal(pdf.subarray(0,5).toString(),"%PDF-");assert.equal(decrypts,1);
  await assert.rejects(sample.open(principal,proof.accessToken,check),/document_verification_required/);
});
