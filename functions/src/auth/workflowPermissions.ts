// Extra authority for claim/collection-state changes. This does not grant roles.
export function collectionActionAllowed(roles: readonly string[], method: string, path: string, body: unknown): boolean {
  if (method !== "POST") return true;
  const scheduleDecision = /^\/workspace\/linked-schedule-creations\/(review|execute)$/.test(path);
  const scheduleRecovery = path === "/workspace/write-recovery/approve" && !!body && typeof body === "object" && !Array.isArray(body) && (body as Record<string, unknown>).family === "linked_schedule_create";
  if ((scheduleDecision || scheduleRecovery) && !roles.includes("scheduling_reviewer")) return false;
  const collectionDecision = /^\/workspace\/collection-notes\/(review|execute)$/.test(path);
  const recoveryApproval = path === "/workspace/write-recovery/approve" && !!body && typeof body === "object" && !Array.isArray(body) && (body as Record<string, unknown>).family === "collection_note";
  return !(collectionDecision || recoveryApproval) || roles.includes("collections_reviewer");
}
