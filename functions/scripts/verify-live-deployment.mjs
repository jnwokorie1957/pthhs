import { appendFileSync } from "node:fs";

// Deployment credentials are not an approved user's normal sign-in session.
// Do not discover an administrator, mint/exchange tokens, or call HHA from CI.
// Keep this unmet acceptance gate visible independently of deployment success.
const message = "BLOCKED: authenticated Primetime/HHA acceptance requires the exact approved administrator's normal sign-in session. No administrator was selected, no credentials were created, and no protected API or HHA request was made. Verify /primetime/api/session and /primetime/api/hha/health through the approved normal session; deployment and anonymous checks do not satisfy this gate.";

console.error(message);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n### Authenticated acceptance: BLOCKED\n\n${message}\n`);
}
process.exitCode = 2;
