import test from "node:test";
import assert from "node:assert/strict";
import { DocumentAccess, sensitiveDocumentPath, type DocumentPrincipal } from "./documentAccess.js";

function fixture() {
  const records = new Map<string, Record<string, any>>();
  let now = 1000000, queue = Promise.resolve();
  const ref = (path: string) => ({path, get: async () => ({data: () => structuredClone(records.get(path))})});
  const db = {
    collection: (name: string) => ({doc: (id: string) => ref(name + "/" + id)}),
    runTransaction: (fn: (tx: any) => Promise<any>) => {
      const result = queue.then(async () => {
        const writes = new Map<string, Record<string, any>>();
        const tx = {
          get: (r: ReturnType<typeof ref>) => r.get(),
          set: (r: ReturnType<typeof ref>, value: object) => writes.set(r.path, structuredClone(value)),
          create: (r: ReturnType<typeof ref>, value: object) => { assert(!records.has(r.path)); writes.set(r.path, structuredClone(value)); },
          update: (r: ReturnType<typeof ref>, value: object) => writes.set(r.path, {...records.get(r.path), ...value})
        };
        const value = await fn(tx);
        for (const [path, write] of writes) records.set(path, write);
        return value;
      });
      queue = result.then(() => undefined, () => undefined);
      return result;
    }
  };
  const service = new DocumentAccess(db as unknown as ConstructorParameters<typeof DocumentAccess>[0], () => now);
  const principal: DocumentPrincipal = {uid: "synthetic-hr", email: "staff@example.invalid", authTime: 100};
  const path = "/staff/applications/synthetic-a/documents/test-a/print";
  const allow = async () => {};
  const code = (id: string) => records.get("workforceIdentityMail/verify-" + id)!.message.text.match(/\b\d{6}\b/)![0] as string;
  return {records, service, principal, path, allow, code, advance: () => { now += 300001; }};
}

test("verification is account/session/path bound and a proof is consumed exactly once under concurrency", async () => {
  const f = fixture(), challenge = await f.service.request(f.principal, f.path, f.allow);
  assert(!JSON.stringify(challenge).includes(f.code(challenge.challengeId)));
  await assert.rejects(f.service.verify({...f.principal, uid: "other"}, challenge.challengeId, f.code(challenge.challengeId), f.allow), /document_verification_required/);
  await assert.rejects(f.service.verify({...f.principal, authTime: 101}, challenge.challengeId, f.code(challenge.challengeId), f.allow), /document_verification_required/);
  const proof = await f.service.verify(f.principal, challenge.challengeId, f.code(challenge.challengeId), f.allow);
  await assert.rejects(f.service.consume(f.principal, f.path + "-other", proof.accessToken, f.allow), /document_verification_required/);
  const results = await Promise.allSettled([1, 2].map(() => f.service.consume(f.principal, f.path, proof.accessToken, f.allow)));
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(results.filter(r => r.status === "rejected").length, 1);
});

test("wrong codes count toward the guess limit and expiration cannot be bypassed", async () => {
  const f = fixture(), challenge = await f.service.request(f.principal, f.path, f.allow);
  const correct = f.code(challenge.challengeId), wrong = correct === "000000" ? "000001" : "000000";
  for (let i = 0; i < 5; i++) await assert.rejects(f.service.verify(f.principal, challenge.challengeId, wrong, f.allow), /invalid_document_code/);
  await assert.rejects(f.service.verify(f.principal, challenge.challengeId, correct, f.allow), /invalid_document_code/);
  const second = await f.service.request(f.principal, f.path, f.allow);
  f.advance();
  await assert.rejects(f.service.verify(f.principal, second.challengeId, f.code(second.challengeId), f.allow), /invalid_document_code/);
});

test("current authorization is checked at request, code verification and document release", async () => {
  const f = fixture(); let allowed = true;
  const check = async () => { if (!allowed) throw Error("access_revoked"); };
  const challenge = await f.service.request(f.principal, f.path, check);
  allowed = false;
  await assert.rejects(f.service.verify(f.principal, challenge.challengeId, f.code(challenge.challengeId), check), /access_revoked/);
  allowed = true;
  const proof = await f.service.verify(f.principal, challenge.challengeId, f.code(challenge.challengeId), check);
  allowed = false;
  await assert.rejects(f.service.consume(f.principal, f.path, proof.accessToken, check), /access_revoked/);
  await assert.rejects(f.service.request(f.principal, f.path, check), /access_revoked/);
});

test("the mail rate limit and protected route allowlist cover direct documents and packet/print alternatives", async () => {
  const f = fixture();
  for (let i = 0; i < 3; i++) await f.service.request(f.principal, f.path, f.allow);
  await assert.rejects(f.service.request(f.principal, f.path, f.allow), /document_verification_limit/);
  for (const route of ["/application/documents/test", "/application/forms/w4/pdf", "/staff/applications/synthetic-a/packet/pdf", f.path]) assert(sensitiveDocumentPath(route));
  for (const route of ["//evil.example", "/application/documents", "/staff/roster/101/files/1", "/application/documents/test?access=1"]) assert(!sensitiveDocumentPath(route));
});
