import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { isAbsolute } from "node:path";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { MAX_DOCUMENT_BYTES } from "../lib/workforce/documents.js";
import { IntakeStore, privateDocumentPath } from "../lib/workforce/intakeStore.js";

const [documentId] = process.argv.slice(2);
const scanner = process.env.WORKFORCE_CLAMSCAN;
const projectId = process.env.GOOGLE_CLOUD_PROJECT;
const bucketName = process.env.WORKFORCE_SCAN_BUCKET;
if (!/^[a-zA-Z0-9_-]{1,128}$/.test(documentId ?? "") || !scanner || !isAbsolute(scanner) || !projectId || !bucketName) {
  throw Error("Specify the document ID, GOOGLE_CLOUD_PROJECT, WORKFORCE_SCAN_BUCKET, and an absolute WORKFORCE_CLAMSCAN path.");
}

function scanPdf(bytes) {
  return new Promise((resolve, reject) => {
    const scan = spawn(scanner, [
      "--official-db-only=yes", "--fail-if-cvd-older-than=2", "--alert-encrypted=yes",
      "--alert-exceeds-max=yes", "--max-filesize=8M", "--max-scansize=32M", "-",
    ], { stdio: ["pipe", "pipe", "ignore"], timeout: 90_000 });
    let output = "";
    scan.stdout.setEncoding("utf8");
    scan.stdout.on("data", chunk => { output = (output + chunk).slice(-4096); });
    scan.stdin.on("error", () => reject(Error("PDF scanner did not read the file.")));
    scan.on("error", () => reject(Error("PDF scanner is unavailable.")));
    scan.on("close", code => {
      if (code === 0 && /Scanned files:\s+1\b/.test(output) && /Infected files:\s+0\b/.test(output)) resolve("clean");
      else if (code === 1 && /Infected files:\s+1\b/.test(output)) resolve("rejected");
      else reject(Error("PDF scanner did not return a usable verdict."));
    });
    scan.stdin.end(bytes);
  });
}

async function main() {
  initializeApp({ projectId });
  const db = getFirestore(), bucket = getStorage().bucket(bucketName);
  const record = (await db.collection("workforcePrivateDocuments").doc(documentId).get()).data();
  if (record?.state !== "pending_security_review" || record.extension !== "pdf"
    || !/^\d+$/.test(record.generation ?? "") || !/^[0-9a-f]{64}$/.test(record.sha256 ?? "")
    || !Number.isInteger(record.size) || record.size < 1 || record.size > MAX_DOCUMENT_BYTES) {
    throw Error("Document is unavailable for PDF screening.");
  }
  const file = bucket.file(privateDocumentPath(record.uid, documentId, "pdf"), { generation: record.generation });
  const [metadata] = await file.getMetadata();
  if (String(metadata.generation) !== record.generation || Number(metadata.size) !== record.size) {
    throw Error("Stored PDF version does not match the quarantine record.");
  }
  const [bytes] = await file.download({ validation: "crc32c" });
  if (bytes.length !== record.size || createHash("sha256").update(bytes).digest("hex") !== record.sha256) {
    throw Error("Stored PDF digest does not match the quarantine record.");
  }
  const verdict = await scanPdf(bytes);
  const result = await new IntakeStore(db, bucket).recordPdfScan(documentId, record.generation, record.sha256, verdict);
  console.log(JSON.stringify({ state: result.state }));
}

try { await main(); }
catch {
  // File bytes, document IDs and scanner signature details stay out of logs.
  console.error("PDF screening did not complete. Check the scanner and quarantine record.");
  process.exitCode = 1;
}
