// Validate before loading handlers or initializing any Firebase clients.
process.env.PORTAL_TEST_BUILD = "true";
const {resources: selected} = await import("./portalResources.js");
if (!selected.testKey) throw Error("Missing test resource configuration");
process.env.WORKFORCE_DOCUMENT_KMS_KEY = selected.testKey;
process.env.WORKFORCE_PORTAL_ORIGIN = "https://" + selected.project + ".web.app";
const handlers = await import("./workforce/http.js");
export const workforceApi = handlers.workforceApi;
export const workforceDocumentDecrypt = handlers.workforceDocumentDecrypt;
