import { appendFileSync } from "node:fs";

// Reporting a human acceptance prerequisite is separate from attempting it.
// This script does not inspect identities, use credentials, or make requests.
const message = "PENDING: authenticated Primetime/HHA acceptance has not been performed. The approved owner must complete normal email-link sign-in and verify /primetime/api/session, then /primetime/api/hha/health. Deployment and anonymous boundary checks do not establish administrator or HHA acceptance. Operational data and write approvals remain separate.";

console.log(message);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n### Authenticated acceptance: PENDING\n\n${message}\n\nThis informational report does not change the deployment result. A successful deployment is not authenticated acceptance.\n`);
}
