// Minimal in-memory stand-in for the parts of the Firestore Admin API used by
// createRecruitmentFirestoreService. Nothing here touches the network.
import { randomUUID } from "node:crypto";

const clone = (value) => structuredClone(value);
const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

// Firestore set(..., { merge: true }) deep-merges nested maps.
const deepMerge = (target, source) => {
  const output = { ...target };
  for (const [key, value] of Object.entries(source)) {
    output[key] = isPlainObject(value) && isPlainObject(output[key])
      ? deepMerge(output[key], value)
      : clone(value);
  }
  return output;
};

// Options:
//   latencyMs - delay every read, to widen check-then-write windows the way network round
//               trips to real Firestore do (used by concurrency tests).
// Transactions are serialised, matching Firestore server-side transactions, which lock the
// documents they read so a conflicting transaction waits and then sees the committed write.
export const createFakeFirestore = (seed = {}, { latencyMs = 0 } = {}) => {
  const pause = () => (latencyMs ? new Promise((resolve) => setTimeout(resolve, latencyMs)) : null);
  let transactionQueue = Promise.resolve();
  const collections = new Map();
  const store = (name) => {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name);
  };
  for (const [name, docs] of Object.entries(seed)) {
    for (const [id, data] of Object.entries(docs)) store(name).set(id, clone(data));
  }

  const snapshotOf = (id, data) => ({
    id,
    exists: data !== undefined,
    data: () => (data === undefined ? undefined : clone(data)),
  });

  const docRef = (collectionName, id = randomUUID().replace(/-/g, "")) => ({
    id,
    async get() { await pause(); return snapshotOf(id, store(collectionName).get(id)); },
    async set(data, options = {}) {
      const existing = store(collectionName).get(id);
      store(collectionName).set(id, options.merge && existing ? deepMerge(existing, data) : clone(data));
    },
    async delete() { store(collectionName).delete(id); },
  });

  const query = (collectionName, filters = [], limit = Infinity) => ({
    where(field, operator, value) {
      if (operator !== "==") throw new Error(`Fake Firestore supports only ==, got ${operator}`);
      return query(collectionName, [...filters, [field, value]], limit);
    },
    limit(count) { return query(collectionName, filters, count); },
    doc(id) { return docRef(collectionName, id); },
    async get() {
      await pause();
      const docs = [...store(collectionName).entries()]
        .filter(([, data]) => filters.every(([field, value]) => data[field] === value))
        .slice(0, limit)
        .map(([id, data]) => snapshotOf(id, data));
      return { empty: docs.length === 0, docs, size: docs.length };
    },
  });

  return {
    collection: (name) => query(name),
    runTransaction(work) {
      const run = transactionQueue.then(() => {
        const transaction = {
          get: (ref) => ref.get(),
          set: (ref, data, options) => { ref.set(data, options); return transaction; },
          delete: (ref) => { ref.delete(); return transaction; },
        };
        return work(transaction);
      });
      transactionQueue = run.catch(() => {});
      return run;
    },
    // Test helper: raw stored data, bypassing any API-layer redaction.
    dump: (name) => Object.fromEntries([...store(name).entries()].map(([id, data]) => [id, clone(data)])),
    // Test helper: write a raw document, bypassing validation (e.g. legacy data shapes).
    put: (name, id, data) => { store(name).set(id, clone(data)); },
  };
};
