# Release recovery boundaries

Use `main` for reviewed fixes. Preserve the failing commit SHA, workflow URL, failed step and sanitized error before deciding on recovery. Never copy credentials, patient records or full SOAP payloads into an issue or log.

## Choose the affected component

- **Static website regression:** confirm the failing page and committed asset versions. Prefer a narrow tested fix. If a rollback is needed, review a `git revert` of the offending commit on main, run the full site checks, then publish under the applicable deployment authorization. Do not force-push or reset shared history. Check both Hosting and backend jobs: the existing main workflow attempts both independently.
- **Backend code regression:** keep operational data and write gates closed. Review a forward fix or compatible revert, run backend tests and contract checks, and inspect the exact deployed revision before testing protected routing. A source revert does not undo external HHA changes or persistent database state.
- **IAM/API/secret prerequisite:** stop at the exact denied action and principal. A source rollback or repeated retry cannot grant access. Route the smallest required action to the authorized administrator; do not broaden roles, read secret values or enable services as a workaround.
- **Uncertain HHA write:** do not repeat the mutation or clear target locks. Use the operation's supported read-only reconciliation and independent audited recovery. Linked-schedule applied recovery remains unavailable until a supported persisted-type evidence verifier exists; human assertions alone are insufficient.
- **Interrupted import:** retain its durable lock and checkpoint. Confirm the previous worker is terminated before approved operational recovery. Do not start concurrent imports or advance cursors to hide a failed run.

## Verify before calling recovery complete

1. Confirm the exact remote main SHA and that local work is preserved.
2. Run the relevant regression tests and full release checks for changed components.
3. Follow the exact commit's workflow to terminal state. Report Hosting and Functions outcomes separately.
4. For Hosting, compare public asset bytes with committed Git bytes and verify approved logos and phone-first contact links.
5. For Functions, verify unauthenticated access is rejected. Authenticated acceptance needs the approved administrator; source-data acceptance needs separate privacy, entitlement and policy approvals. A successful deployment is not permission to activate data or mutations.

Database backup schedules, retention, restore targets and disaster-recovery drills require owner/platform decisions and have not been completed by this document. Do not claim a database or vendor-state rollback is available merely because Git can revert code.
