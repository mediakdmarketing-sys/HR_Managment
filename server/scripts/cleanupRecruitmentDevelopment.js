import "dotenv/config";
import fs from "node:fs";

const PROJECT_ID = "hrms-65efa";
const BATCH_ID = "hrms-recruitment-dev-v1";
const EXECUTE = process.argv.includes("--execute");

const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
let credentialProjectId = "";

if (credentialPath && fs.existsSync(credentialPath)) {
  const credentials = JSON.parse(fs.readFileSync(credentialPath, "utf8"));
  credentialProjectId = credentials.project_id || "";
}

const configuredProjectId =
  process.env.FIREBASE_PROJECT_ID ||
  credentialProjectId ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  "";

if (configuredProjectId !== PROJECT_ID) {
  throw new Error("Firebase project verification failed; cleanup stopped.");
}

if (credentialProjectId && credentialProjectId !== PROJECT_ID) {
  throw new Error("Credential project mismatch; cleanup stopped.");
}

if (process.env.NODE_ENV === "production") {
  throw new Error("Development cleanup refuses to run in production.");
}

const { firestore, storageBucket, admin } =
  await import("../config/firebase.js");

const app = admin.app();
const initializedProjectId = app.options.projectId;

if (initializedProjectId && initializedProjectId !== PROJECT_ID) {
  throw new Error("Initialized Firebase app project mismatch; cleanup stopped.");
}

const { RECRUITMENT_COLLECTIONS } =
  await import("../services/recruitmentService.js");

const collectionNames = [
  ...new Set([...RECRUITMENT_COLLECTIONS, "recruitmentUniqueKeys"]),
];

const recordsByCollection = new Map();
const references = [];
const storagePaths = new Set();

for (const collectionName of collectionNames) {
  const snapshot = await firestore
    .collection(collectionName)
    .where("seedBatchId", "==", BATCH_ID)
    .get();

  const matches = snapshot.docs.filter(
    (doc) => doc.data().isTestData === true
  );

  recordsByCollection.set(collectionName, matches);
  references.push(...matches.map((doc) => doc.ref));

  if (collectionName === "recruitmentAttachments") {
    for (const doc of matches) {
      const path = doc.data().storagePath;

      if (path) {
        if (
          typeof path !== "string" ||
          !path.startsWith("recruitment/")
        ) {
          throw new Error("Unexpected attachment Storage path; cleanup stopped.");
        }

        storagePaths.add(path);
      }
    }
  }
}

const bucketName = storageBucket?.name || "";
const bucketConfigured =
  typeof bucketName === "string" &&
  bucketName.toLowerCase().includes(PROJECT_ID);

if (bucketName && !bucketConfigured) {
  throw new Error("Storage bucket project mismatch; cleanup stopped.");
}

let storageScanAvailable = false;

if (bucketConfigured) {
  try {
    const [orphanFiles] = await storageBucket.getFiles({
      prefix: `recruitment/test-data/${BATCH_ID}/`,
    });

    for (const file of orphanFiles) {
      if (!file.name.startsWith(`recruitment/test-data/${BATCH_ID}/`)) {
        throw new Error("Unexpected Storage object path; cleanup stopped.");
      }

      storagePaths.add(file.name);
    }

    storageScanAvailable = true;
  } catch (error) {
    const isNotFound =
      Number(error.code) === 404 ||
      error.code === "404";

    if (!isNotFound || storagePaths.size > 0) {
      throw new Error(
        "Storage verification failed; cleanup stopped."
      );
    }
  }
} else if (storagePaths.size > 0) {
  throw new Error(
    "Attachment records reference Storage files, but no verified bucket is available. Cleanup stopped."
  );
}

for (const path of storagePaths) {
  if (!path.startsWith("recruitment/")) {
    throw new Error("Unexpected Storage path; cleanup stopped.");
  }

  try {
    const [metadata] = await storageBucket.file(path).getMetadata();

    if (
      metadata.metadata?.isTestData !== "true" ||
      metadata.metadata?.seedBatchId !== BATCH_ID
    ) {
      throw new Error(
        `Storage object ${path} is not marked for this test batch.`
      );
    }
  } catch (error) {
    const isNotFound =
      Number(error.code) === 404 ||
      error.code === "404";

    if (!isNotFound) {
      throw new Error(
        "Storage object verification failed; cleanup stopped."
      );
    }
  }
}

const counts = Object.fromEntries(
  [...recordsByCollection].map(([collection, records]) => [
    collection,
    records.length,
  ])
);

console.log(`Target Firebase project: ${PROJECT_ID}`);
console.log(`Exact test batch: ${BATCH_ID}`);
console.log(`records_by_collection=${JSON.stringify(counts)}`);
console.log(`verified_storage_objects=${storagePaths.size}`);
console.log(`storage_scan_available=${storageScanAvailable}`);

if (!bucketConfigured) {
  console.log(
    "Storage bucket unavailable. Firestore-only cleanup is possible because no matching attachment paths were found."
  );
}

console.log(`Total Firestore records to delete: ${references.length}`);

if (!EXECUTE) {
  console.log(
    "DRY RUN ONLY. No records or Storage objects have been deleted."
  );
  console.log(
    "Review the counts before using --execute."
  );
} else {
  for (const path of storagePaths) {
    await storageBucket.file(path).delete({
      ignoreNotFound: true,
    });
  }

  for (let start = 0; start < references.length; start += 400) {
    const batch = firestore.batch();

    for (const reference of references.slice(start, start + 400)) {
      batch.delete(reference);
    }

    await batch.commit();
  }

  console.log("Verified test batch cleanup completed.");
}