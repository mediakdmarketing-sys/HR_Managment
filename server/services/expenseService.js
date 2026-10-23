import { firestore } from "../config/firebase.js";

const transactions = firestore.collection("transactions");

const toTransaction = (snapshot) => ({ id: snapshot.id, ...snapshot.data() });

export const listTransactions = async () => {
  const snapshot = await transactions.get();
  return snapshot.docs
    .map(toTransaction)
    .sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt).localeCompare(String(a.createdAt)));
};

export const createTransaction = async (data, user) => {
  const reference = transactions.doc();
  const transaction = {
    ...data,
    createdBy: user.name || user.email || "",
    createdAt: new Date().toISOString(),
  };
  await reference.set(transaction);
  return { id: reference.id, ...transaction };
};

export const updateTransaction = async (id, data, user) => {
  const reference = transactions.doc(id);
  const snapshot = await reference.get();
  if (!snapshot.exists) return null;
  await reference.update({
    ...data,
    updatedBy: user.name || user.email || "",
    updatedAt: new Date().toISOString(),
  });
  return toTransaction(await reference.get());
};

export const deleteTransaction = async (id) => {
  const reference = transactions.doc(id);
  const snapshot = await reference.get();
  if (!snapshot.exists) return false;
  await reference.delete();
  return true;
};
