import { firestore } from "../config/firebase.js";

const settings = firestore.collection("settings");
const IMAGE_DOCS = { logo: "letterLogo", signature: "letterSignature" };

export const defaultCompany = {
  name: "KD Associates INC (Buffalo)",
  legalName: "KD Associates Buffalo INC",
  address: "9950 County Rd, Clarence Center, NY 14032, USA, New York",
  phone: "+1 716 400 9006",
  email: "kdlandscapingny@gmail.com",
  signatoryTitle: "HR Manager / Director",
};

export const getLetterSettings = async () => {
  const [logo, signature, company] = await Promise.all([
    settings.doc(IMAGE_DOCS.logo).get(),
    settings.doc(IMAGE_DOCS.signature).get(),
    settings.doc("letterCompany").get(),
  ]);
  return {
    logo: logo.exists ? logo.data() : null,
    signature: signature.exists ? signature.data() : null,
    company: { ...defaultCompany, ...(company.exists ? company.data() : {}) },
  };
};

export const saveImage = async (kind, { fileName, mime, data }, user) => {
  const image = {
    fileName,
    mime,
    data,
    updatedBy: user.name || user.email || "",
    updatedAt: new Date().toISOString(),
  };
  await settings.doc(IMAGE_DOCS[kind]).set(image);
  return image;
};

export const removeImage = async (kind) => {
  await settings.doc(IMAGE_DOCS[kind]).delete();
};

export const saveCompany = async (company) => {
  const allowed = Object.keys(defaultCompany);
  const updates = Object.fromEntries(
    allowed.map((field) => [field, String(company[field] ?? "").trim()]),
  );
  await settings.doc("letterCompany").set(updates);
  return updates;
};
