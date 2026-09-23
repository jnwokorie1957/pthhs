import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const projectId = "primetimehomehealthservices";
const app = initializeApp({
  credential: applicationDefault(),
  projectId,
});
const auth = getAuth(app);

const users = [];
let pageToken;

do {
  const page = await auth.listUsers(1000, pageToken);
  users.push(...page.users);
  pageToken = page.pageToken;
} while (pageToken);

const existingAdmins = users.filter(
  (user) => user.customClaims?.admin === true,
);

if (existingAdmins.length > 0) {
  console.log("Primetime admin claim already exists; bootstrap not needed.");
  process.exit(0);
}

if (users.length !== 1) {
  console.error(
    "Refusing admin bootstrap: expected exactly one Firebase Auth user and no existing admin.",
  );
  console.error("User count:", users.length);
  process.exit(1);
}

const [user] = users;
if (!user || user.disabled) {
  console.error("Refusing admin bootstrap: sole Firebase Auth user is missing or disabled.");
  process.exit(1);
}

const hasPasswordProvider = user.providerData.some(
  (provider) => provider.providerId === "password",
);

if (!hasPasswordProvider) {
  console.error(
    "Refusing admin bootstrap: sole Firebase Auth user is not an Email/Password user.",
  );
  process.exit(1);
}

await auth.setCustomUserClaims(user.uid, {
  ...(user.customClaims ?? {}),
  admin: true,
  role:
    typeof user.customClaims?.role === "string"
      ? user.customClaims.role
      : "admin",
});

console.log("Primetime admin claim bootstrapped for the sole trusted Auth user.");
console.log("UID:", user.uid);
