#!/usr/bin/env node
/**
 * HRMS read-only backup tool (Stage 0).
 *
 * READ-ONLY: this script only reads from Firestore and Firebase Auth.
 * It never creates, updates or deletes any document, user or file in Firebase.
 *
 * What it writes (to your laptop only):
 *   <out>/<collection>.jsonl        one line per document, every collection and subcollection
 *   <out>/auth-users-summary.json   uid, email, disabled flag, dates (NO password hashes)
 *   <out>/manifest.json             document counts and SHA-256 hash of every file
 *
 * Usage (run from the server folder, or anywhere):
 *   node scripts/backup-firestore.js --project hrms-65efa
 *   node scripts/backup-firestore.js --verify "C:\Users\you\hrms-backups\<folder>" --project hrms-65efa
 *
 * Safety rules built in:
 *   - --project is required and must match the project your server/.env connects to.
 *   - The backup folder must be OUTSIDE the repository (so it can never be committed).
 *   - Document contents are never printed to the screen, only names and counts.
 *
 * Password hashes are NOT included here. For a restorable Auth export use:
 *   firebase auth:export <file> --format=json --project hrms-65efa
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(SERVER_DIR, "..");
const TOOL_VERSION = "1.0.0";
const PAGE_SIZE = 500;

// ---------------------------------------------------------------- helpers

export function parseArgs(argv) {
  const args = { project: null, out: null, verify: null, subcollections: true, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--project") args.project = argv[++i];
    else if (arg === "--out") args.out = argv[++i];
    else if (arg === "--verify") args.verify = argv[++i];
    else if (arg === "--no-subcollections") args.subcollections = false;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return args;
}

/** Converts Firestore values to plain JSON, keeping type information. */
export function serializeValue(value) {
  if (value === null || value === undefined) return value ?? null;
  const type = typeof value;
  if (type === "number") {
    return Number.isFinite(value) ? value : { __type: "number", value: String(value) };
  }
  if (type === "string" || type === "boolean") return value;
  if (type === "bigint") return { __type: "bigint", value: value.toString() };
  if (Array.isArray(value)) return value.map(serializeValue);
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return { __type: "bytes", base64: Buffer.from(value).toString("base64") };
  }
  const name = value.constructor?.name;
  if (name === "Timestamp") {
    return { __type: "timestamp", seconds: value.seconds, nanoseconds: value.nanoseconds };
  }
  if (name === "GeoPoint") {
    return { __type: "geopoint", latitude: value.latitude, longitude: value.longitude };
  }
  if (name === "DocumentReference") return { __type: "reference", path: value.path };
  if (name === "VectorValue") return { __type: "vector", values: value.toArray() };
  const out = {};
  for (const [key, inner] of Object.entries(value)) out[key] = serializeValue(inner);
  return out;
}

/** Works out which Firebase project the server's credentials belong to (no network). */
export function resolveConfiguredProject(env = process.env, readFile = fs.readFileSync) {
  if (env.GOOGLE_APPLICATION_CREDENTIALS) {
    const key = JSON.parse(readFile(env.GOOGLE_APPLICATION_CREDENTIALS, "utf8"));
    return { projectId: key.project_id, emailProject: null, source: "GOOGLE_APPLICATION_CREDENTIALS key file" };
  }
  const email = env.FIREBASE_CLIENT_EMAIL || "";
  const emailProject = email.includes("@")
    ? email.split("@")[1].replace(/\.iam\.gserviceaccount\.com$/, "")
    : null;
  return { projectId: env.FIREBASE_PROJECT_ID || null, emailProject, source: "server/.env" };
}

/** Throws unless every configured project value equals the project named on the command line. */
export function assertProjectMatches(expected, configured) {
  if (!expected) throw new Error("Missing --project. Example: --project hrms-65efa");
  if (!configured.projectId) throw new Error("No Firebase project is configured in server/.env");
  if (configured.projectId !== expected) {
    throw new Error(
      `Project mismatch: you asked for "${expected}" but the server is configured for "${configured.projectId}". Nothing was read.`,
    );
  }
  if (configured.emailProject && configured.emailProject !== expected) {
    throw new Error(
      `Service account belongs to "${configured.emailProject}", not "${expected}". Nothing was read.`,
    );
  }
}

export function assertOutsideRepo(dir, repoRoot = REPO_ROOT) {
  const resolved = path.resolve(dir);
  const relative = path.relative(repoRoot, resolved);
  const inside = relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
  if (inside) {
    throw new Error(
      `Refusing to write the backup inside the project folder (${resolved}). Choose a folder outside the repository.`,
    );
  }
}

export function defaultOutputDir(projectId, now = new Date()) {
  const stamp = now.toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
  return path.join(os.homedir(), "hrms-backups", `${projectId}_${stamp}`);
}

const sha256File = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

// ----------------------------------------------------------------- backup

async function exportCollection(colRef, ctx) {
  const name = colRef.path.replaceAll("/", "__");
  const file = path.join(ctx.dir, `${name}.jsonl`);
  fs.writeFileSync(file, "");
  let count = 0;
  let last = null;
  for (;;) {
    let query = colRef.orderBy(ctx.FieldPath.documentId()).limit(PAGE_SIZE);
    if (last) query = query.startAfter(last);
    const snap = await query.get();
    if (snap.empty) break;
    const lines = [];
    const subs = [];
    for (const doc of snap.docs) {
      lines.push(
        JSON.stringify({
          id: doc.id,
          path: doc.ref.path,
          createTime: doc.createTime?.toDate().toISOString() ?? null,
          updateTime: doc.updateTime?.toDate().toISOString() ?? null,
          data: serializeValue(doc.data()),
        }),
      );
      count += 1;
      if (ctx.subcollections) subs.push(...(await doc.ref.listCollections()));
    }
    fs.appendFileSync(file, `${lines.join("\n")}\n`);
    for (const sub of subs) await exportCollection(sub, ctx);
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < PAGE_SIZE) break;
  }
  ctx.collections.push({ path: colRef.path, file: `${name}.jsonl`, documents: count });
}

async function exportAuthSummary(firebaseAuth, dir) {
  const users = [];
  let pageToken;
  do {
    const page = await firebaseAuth.listUsers(1000, pageToken);
    for (const user of page.users) {
      users.push({
        uid: user.uid,
        email: user.email ?? null,
        disabled: user.disabled,
        emailVerified: user.emailVerified,
        createdAt: user.metadata?.creationTime ?? null,
        lastSignInAt: user.metadata?.lastSignInTime ?? null,
        providers: (user.providerData ?? []).map((p) => p.providerId),
      });
    }
    pageToken = page.pageToken;
  } while (pageToken);
  fs.writeFileSync(path.join(dir, "auth-users-summary.json"), JSON.stringify(users, null, 2));
  return users.length;
}

export async function runBackup({ firestore, firebaseAuth, FieldPath, projectId, dir, subcollections = true, log = console.log }) {
  fs.mkdirSync(dir, { recursive: true });
  const ctx = { dir, FieldPath, subcollections, collections: [] };
  const roots = await firestore.listCollections();
  for (const root of roots) await exportCollection(root, ctx);
  const authUsers = firebaseAuth ? await exportAuthSummary(firebaseAuth, dir) : null;

  const files = ctx.collections
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((entry) => ({
      ...entry,
      bytes: fs.statSync(path.join(dir, entry.file)).size,
      sha256: sha256File(path.join(dir, entry.file)),
    }));
  const manifest = {
    tool: "hrms backup-firestore",
    toolVersion: TOOL_VERSION,
    projectId,
    createdAt: new Date().toISOString(),
    includesSubcollections: subcollections,
    totalDocuments: files.reduce((sum, f) => sum + f.documents, 0),
    authUsers,
    authSummarySha256: authUsers === null ? null : sha256File(path.join(dir, "auth-users-summary.json")),
    collections: files,
    notes: [
      "Read-only export. No data was changed in Firebase.",
      "Auth summary contains no password hashes. Use `firebase auth:export` for a restorable copy.",
      "Documents that exist only as parents of subcollections (no fields) are not captured.",
    ],
  };
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));

  log(`\nProject: ${projectId}`);
  log("Collection".padEnd(40) + "Documents");
  for (const f of files) log(f.path.padEnd(40) + String(f.documents));
  log("-".repeat(50));
  log("TOTAL".padEnd(40) + manifest.totalDocuments);
  if (authUsers !== null) log(`Auth users (summary only): ${authUsers}`);
  log(`\nBackup folder: ${dir}`);
  return manifest;
}

// ----------------------------------------------------------------- verify

export async function runVerify({ firestore, projectId, dir, log = console.log }) {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
  if (manifest.projectId !== projectId) {
    throw new Error(`This backup is for "${manifest.projectId}", not "${projectId}".`);
  }
  let integrityOk = true;
  let changed = 0;
  log(`Verifying backup created ${manifest.createdAt}\n`);
  log("Collection".padEnd(34) + "Backup".padEnd(9) + "Live".padEnd(9) + "File check".padEnd(12) + "Status");
  for (const entry of manifest.collections) {
    const file = path.join(dir, entry.file);
    let fileOk = fs.existsSync(file) && sha256File(file) === entry.sha256;
    if (fileOk) {
      const lines = fs.readFileSync(file, "utf8").split("\n").filter(Boolean).length;
      fileOk = lines === entry.documents;
    }
    if (!fileOk) integrityOk = false;
    const live = (await firestore.collection(entry.path).count().get()).data().count;
    const status = live === entry.documents ? "same" : `changed since backup (${live - entry.documents > 0 ? "+" : ""}${live - entry.documents})`;
    if (live !== entry.documents) changed += 1;
    log(entry.path.padEnd(34) + String(entry.documents).padEnd(9) + String(live).padEnd(9) + (fileOk ? "OK" : "CORRUPT").padEnd(12) + status);
  }
  if (manifest.authSummarySha256) {
    const authFile = path.join(dir, "auth-users-summary.json");
    const ok = fs.existsSync(authFile) && sha256File(authFile) === manifest.authSummarySha256;
    if (!ok) integrityOk = false;
    log(`\nAuth summary file: ${ok ? "OK" : "CORRUPT"}`);
  }
  log(
    integrityOk
      ? `\nBackup files are intact.${changed ? ` ${changed} collection(s) changed in Firebase since the backup (expected if you used the app).` : ""}`
      : "\nBACKUP FILES FAILED THE INTEGRITY CHECK. Do not rely on this backup; take a new one.",
  );
  return { integrityOk, changed };
}

// ------------------------------------------------------------------- main

const HELP = `
HRMS read-only Firestore backup

  node scripts/backup-firestore.js --project <projectId> [--out <folder>] [--no-subcollections]
  node scripts/backup-firestore.js --verify <backupFolder> --project <projectId>

Default output folder: ${path.join(os.homedir(), "hrms-backups")}\\<project>_<date-time>
`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    return;
  }
  dotenv.config({ path: path.join(SERVER_DIR, ".env"), quiet: true });
  assertProjectMatches(args.project, resolveConfiguredProject());
  const backupDir = args.verify ? null : path.resolve(args.out || defaultOutputDir(args.project));
  if (backupDir) assertOutsideRepo(backupDir); // checked before connecting to Firebase

  const { firestore, firebaseAuth, admin } = await import("../config/firebase.js");
  const FieldPath = admin.firestore.FieldPath;

  if (args.verify) {
    const { integrityOk } = await runVerify({ firestore, projectId: args.project, dir: path.resolve(args.verify) });
    process.exitCode = integrityOk ? 0 : 1;
    return;
  }
  const dir = backupDir;
  await runBackup({
    firestore,
    firebaseAuth,
    FieldPath,
    projectId: args.project,
    dir,
    subcollections: args.subcollections,
  });
  console.log("\nThis folder contains sensitive HR data. Keep it private and never upload it to GitHub.");
  console.log(`Next: node scripts/backup-firestore.js --verify "${dir}" --project ${args.project}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`\nERROR: ${error.message}`);
    process.exit(1);
  });
}
