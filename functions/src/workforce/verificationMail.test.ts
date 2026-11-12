import test from "node:test";
import assert from "node:assert/strict";
import {DocumentAccess} from "./documentAccess.js";
import {DocumentVerificationMail, GraphVerificationTransport} from "./verificationMail.js";

function fixture() {
  const records = new Map<string, any>(); let now = 1000000, serial = Promise.resolve();
  const ref = (path: string) => ({path, get: async () => ({data: () => structuredClone(records.get(path))}),
    update: async (data: object) => { records.set(path, {...records.get(path), ...data}); }});
  const db: any = {collection: (name: string) => ({doc: (id: string) => ref(name + "/" + id)}), runTransaction: (fn: any) => {
    const task = serial.then(async () => {
      const writes: [string, any][] = [];
      const value = await fn({get: (r: any) => r.get(), set: (r: any, v: any) => writes.push([r.path, v]),
        create: (r: any, v: any) => writes.push([r.path, v]), update: (r: any, v: any) => writes.push([r.path, {...records.get(r.path), ...v}])});
      for (const [path, data] of writes) records.set(path, structuredClone(data)); return value;
    }); serial = task.then(() => {}, () => {}); return task;
  }};
  const principal = {uid: "synthetic", email: "test@example.invalid", authTime: 1};
  const sent: any[] = []; let fail = false;
  const mail = new DocumentVerificationMail({prepare: async () => async message => { sent.push(message); if (fail) throw Error("timeout"); }}, db, () => now);
  return {records, principal, sent, mail, fail: () => {fail = true;}, expire: () => {now += 300001;},
    request: () => new DocumentAccess(db, () => now).request(principal, "/application/documents/synthetic", async () => {})};
}

test("mail is account bound, dispatched once under concurrency, and the persisted code is erased", async () => {
  const f = fixture(), challenge = await f.request();
  await assert.rejects(f.mail.send(challenge.challengeId, {...f.principal, email: "other@example.invalid"}), /document_verification_required/);
  const results = await Promise.allSettled([f.mail.send(challenge.challengeId, f.principal), f.mail.send(challenge.challengeId, f.principal)]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(f.sent.length, 1);
  assert.match(f.sent[0].code, /^\d{6}$/);
  const record = f.records.get("workforceIdentityMail/verify-" + challenge.challengeId);
  assert.equal(record.deliveryStatus, "accepted"); assert.equal(record.message, null);
  assert(!JSON.stringify(record).includes(f.sent[0].code));
});

test("old notices, tampered recipients/codes and expired challenges never send", async () => {
  for (const change of ["kind", "to", "code", "expiry"]) {
    const f = fixture(), challenge = await f.request(), record = f.records.get("workforceIdentityMail/verify-" + challenge.challengeId);
    if (change === "kind") record.kind = "identity_notice";
    if (change === "to") record.to.push("other@example.invalid");
    if (change === "code") record.message.text = record.message.text.replace(/\d{6}/, (code: string) => code === "000000" ? "000001" : "000000");
    if (change === "expiry") f.expire();
    await assert.rejects(f.mail.send(challenge.challengeId, f.principal), /document_verification_required/);
    assert.equal(f.sent.length, 0);
  }
});

test("uncertain sends are not retried and have no plaintext code left", async () => {
  const f = fixture(), challenge = await f.request(); f.fail();
  await assert.rejects(f.mail.send(challenge.challengeId, f.principal), /document_verification_delivery_failed/);
  await assert.rejects(f.mail.send(challenge.challengeId, f.principal), /document_verification_required/);
  assert.equal(f.sent.length, 1);
  const record = f.records.get("workforceIdentityMail/verify-" + challenge.challengeId);
  assert.equal(record.deliveryStatus, "unconfirmed"); assert.equal(record.message, null);
});

test("Graph exchanges a workload assertion and sends only the fixed mailbox, code and recipient", async () => {
  const calls: {url: string; init: RequestInit}[] = [];
  const request = (async (url: any, init: RequestInit) => {
    calls.push({url: String(url), init});
    return calls.length === 1 ? new Response(JSON.stringify({access_token: "synthetic-token", token_type: "Bearer"}), {status: 200}) : new Response(null, {status: 202});
  }) as typeof fetch;
  const transport = new GraphVerificationTransport("79734f05-5da8-4995-97cb-c4e065fa327f", "00000000-0000-0000-0000-000000000001", request, async () => "synthetic.assertion.jwt");
  const send = await transport.prepare(); await send({to: "test@example.invalid", code: "123456"});
  const form = new URLSearchParams(String(calls[0]!.init.body));
  assert.equal(form.get("grant_type"), "client_credentials"); assert(!form.has("client_secret"));
  assert.equal(form.get("client_assertion"), "synthetic.assertion.jwt");
  assert.equal(calls[1]!.url, "https://graph.microsoft.com/v1.0/users/jnwokorie%40pthhs.net/sendMail");
  const message = JSON.parse(String(calls[1]!.init.body));
  assert.equal(message.saveToSentItems, false); assert.equal(message.message.attachments, undefined);
  assert.equal(message.message.toRecipients.length, 1); assert.equal(message.message.toRecipients[0].emailAddress.address, "test@example.invalid");
  assert.match(message.message.body.content, /123456/);
  await assert.rejects(send({to: "arbitrary\nheader@example.invalid", code: "123456"}), /invalid_verification_mail/);
});

test("configuration, token errors and non-202 send responses fail closed without leaking provider response", async () => {
  await assert.rejects(new GraphVerificationTransport("bad", "bad").prepare(), /mail_configuration_unavailable/);
  const request = (async () => new Response("provider-secret", {status: 403})) as typeof fetch;
  await assert.rejects(new GraphVerificationTransport("79734f05-5da8-4995-97cb-c4e065fa327f", "00000000-0000-0000-0000-000000000001", request, async () => "a.b.c").prepare(), /mail_identity_unavailable/);
  for (const status of [200, 403, 429, 500]) {
    let calls = 0;
    const rejects = (async () => ++calls === 1 ? new Response(JSON.stringify({access_token:"synthetic",token_type:"Bearer"}),{status:200}) : new Response("provider-private-response",{status})) as typeof fetch;
    const send = await new GraphVerificationTransport("79734f05-5da8-4995-97cb-c4e065fa327f", "00000000-0000-0000-0000-000000000001", rejects, async () => "a.b.c").prepare();
    await assert.rejects(send({to:"owner@example.invalid",code:"123456"}),/mail_dispatch_rejected/);
  }
});
