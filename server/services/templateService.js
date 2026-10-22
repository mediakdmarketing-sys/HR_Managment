import { firestore } from "../config/firebase.js";

const logoReference = firestore.collection("settings").doc("letterLogo");

export const getLogo = async () => {
  const snapshot = await logoReference.get();
  return snapshot.exists ? snapshot.data() : null;
};

export const saveLogo = async ({ fileName, mime, data }, user) => {
  const logo = {
    fileName,
    mime,
    data,
    updatedBy: user.name || user.email || "",
    updatedAt: new Date().toISOString(),
  };
  await logoReference.set(logo);
  return logo;
};
