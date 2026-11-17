import test from 'node:test';
import assert from 'node:assert/strict';
import { SafeHarborTransport,TmhpConnector,ConnectorError,TMHP_ENDPOINTS,type EdiCodec,type TmhpConfiguration } from './connector.js';
const config:TmhpConfiguration={environment:'test',approved:true,submitterId:'SYNTHETIC',password:'TEST-ONLY',receiverId:'617591011TIELT'};
const inquiry={identity:{medicaidId:'000000001',lastName:'Synthetic',birthDate:null},asOf:'2026-11-15',traceId:'synthetic-trace'};
const codec:EdiCodec={encode270:async()=> 'ISA*SYNTHETIC~',decode271:async()=>({matched:true,rejected:false,asOf:inquiry.asOf,medicaidCoverage:[{active:true,effective:null,termination:null}],managedCare:null})};
test('closed approval and invalid member identifiers never dispatch',async()=>{
  let calls=0;const transport={exchange:async()=>{calls++;return 'ISA*TEST~';}};
  const closed=new TmhpConnector(async()=>({...config,approved:false}),codec,transport);
  assert.equal((await closed.verify(inquiry)).reason,'connection_pending');assert.equal(calls,0);
  const open=new TmhpConnector(async()=>config,codec,transport);assert.equal((await open.verify({...inquiry,identity:{...inquiry.identity,medicaidId:'invalid'}})).reason,'invalid_identifier');assert.equal(calls,0);
});
test('expired credentials and unknown delivery stay Unable to Verify with sanitized errors',async()=>{
  for(const code of ['credentials_expired','delivery_unknown'] as const){const service=new TmhpConnector(async()=>config,codec,{exchange:async()=>{throw new ConnectorError(code);}});
    const result=await service.verify(inquiry);assert.equal(result.status,'unable_to_verify');assert.equal(result.reason,code);assert.ok(!JSON.stringify(result).includes(config.password));}
});
test('transport pins official endpoint, refuses redirects, and correlates the CORE response',async()=>{
  const fetcher:typeof fetch=async(url,init)=>{
    assert.equal(url,TMHP_ENDPOINTS.test);assert.equal(init?.redirect,'error');assert.ok(init?.signal);const form=init!.body as FormData;
    assert.equal(form.get('ProcessingMode'),'RealTime');assert.equal(form.get('CORERuleVersion'),'2.2.0');
    const fields={PayloadID:form.get('PayloadID'),PayloadType:'X12_271_Response_005010X279A1',ErrorCode:'Success',
      ProcessingMode:'RealTime',CORERuleVersion:'2.2.0',SenderID:config.receiverId,ReceiverID:config.submitterId,Payload:'ISA*SYNTHETIC~'};
    const body=Object.entries(fields).map(([k,v])=>`--test-boundary\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`).join('')+'--test-boundary--';
    return new Response(body,{headers:{'content-type':'multipart/form-data; boundary=test-boundary'}});
  };
  assert.equal(await new SafeHarborTransport(fetcher).exchange('ISA*TEST~',config),'ISA*SYNTHETIC~');
});
test('non-271, uncorrelated, oversize, and failed HTTP responses are rejected',async()=>{
  for(const response of [new Response('denied',{status:403}),new Response('failure',{status:500}),new Response('ISA*TEST~'),new Response('x'.repeat(2000001))]){
    await assert.rejects(new SafeHarborTransport(async()=>response).exchange('ISA*TEST~',config),ConnectorError);
  }
  await assert.rejects(new SafeHarborTransport(async()=>{throw Error('SECRET AND PHI MUST NOT ESCAPE');}).exchange('ISA*TEST~',config),/delivery_unknown/);
});
