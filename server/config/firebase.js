import admin from "firebase-admin";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY
  ?.trim()
  .replace(/^"(.*)"$/, "$1")
  .replace(/\\n/g, "\n");

const hasPlaceholderCredentials =
  !projectId ||
  !clientEmail ||
  !privateKey ||
  clientEmail.includes("xxxxx") ||
  privateKey.includes("REPLACE_ME") ||
  privateKey.includes("YOUR_KEY");

if (hasPlaceholderCredentials && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  throw new Error(
    "Firebase Admin credentials are missing or still placeholders. " +
      "Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY " +
      "from Firebase Console > Project settings > Service accounts.",
  );
}

const app =
  admin.apps.length > 0
    ? admin.app()
    : admin.initializeApp({
        credential: process.env.GOOGLE_APPLICATION_CREDENTIALS
          ? admin.credential.applicationDefault()
          : privateKey
          ? admin.credential.cert({
              projectId,
              clientEmail,
              privateKey,
            })
          : admin.credential.applicationDefault(),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      });

export const firestore = admin.firestore(app);
export const firebaseAuth = admin.auth(app);
export const storageBucket = admin.storage(app).bucket();
export { admin };
