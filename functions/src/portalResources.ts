export const productionProject = "primetimehomehealthservices";

export function portalResources(env: NodeJS.ProcessEnv) {
  if (env.PORTAL_TEST_BUILD !== "true") {
    return {
      project: productionProject,
      bucket: productionProject + ".firebasestorage.app",
      sender: "jnwokorie@pthhs.net",
      testKey: undefined,
    };
  }
  const project = env.PORTAL_TEST_PROJECT || "";
  const sender = env.PORTAL_TEST_SENDER || "";
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(project) || project === productionProject
      || env.GCLOUD_PROJECT !== project || (env.GOOGLE_CLOUD_PROJECT && env.GOOGLE_CLOUD_PROJECT !== project)) {
    throw Error("Portal test build requires a matching non-production runtime project");
  }
  if (env.FIREBASE_CONFIG && JSON.parse(env.FIREBASE_CONFIG).projectId !== project) {
    throw Error("Portal test Firebase configuration belongs to another project");
  }
  if (!/^[^\s@<>/]+@[^\s@<>/]+\.[^\s@<>/]+$/.test(sender) || sender.toLowerCase() === "jnwokorie@pthhs.net") {
    throw Error("Set PORTAL_TEST_SENDER to the controlled test mailbox");
  }
  const testKey = "projects/" + project + "/locations/us-central1/keyRings/portal-test/cryptoKeys/documents";
  if (env.WORKFORCE_DOCUMENT_KMS_KEY && env.WORKFORCE_DOCUMENT_KMS_KEY !== testKey) {
    throw Error("Portal test KMS key does not match the test project");
  }
  return {project, sender, bucket: project + "-portal-iam-test", testKey};
}
export const resources = portalResources(process.env);
