import { firestore } from "../config/firebase.js";

const settings = firestore.collection("settings");
const IMAGE_DOCS = { logo: "letterLogo", signature: "letterSignature" };
const APPEARANCE_DEFAULTS = {
  themeColor: "#3b7a2f",
  preset: "classic",
  headerStyle: "rule",
  footerStyle: "rule",
};

export const defaultCompany = {
  name: "KD Associates INC (Buffalo)",
  legalName: "KD Associates Buffalo INC",
  address: "9950 County Rd, Clarence Center, NY 14032, USA, New York",
  phone: "+1 716 400 9006",
  email: "kdlandscapingny@gmail.com",
  signatoryTitle: "HR Manager / Director",
};

export const getLetterSettings = async () => {
  const [logo, signature, company, appearance] = await Promise.all([
    settings.doc(IMAGE_DOCS.logo).get(),
    settings.doc(IMAGE_DOCS.signature).get(),
    settings.doc("letterCompany").get(),
    settings.doc("documentAppearance").get(),
  ]);
  return {
    logo: logo.exists ? logo.data() : null,
    signature: signature.exists ? signature.data() : null,
    company: { ...defaultCompany, ...(company.exists ? company.data() : {}) },
    appearance: { ...APPEARANCE_DEFAULTS, ...(appearance.exists ? appearance.data() : {}) },
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

export const saveAppearance = async (appearance) => {
  const themeColor = String(appearance.themeColor || "").trim();
  const preset = String(appearance.preset || "").trim();
  const headerStyle = String(appearance.headerStyle || "").trim();
  const footerStyle = String(appearance.footerStyle || "").trim();
  if (!/^#[0-9a-f]{6}$/i.test(themeColor)) {
    const error = new Error("Theme color must be a six-digit hex color.");
    error.statusCode = 400;
    throw error;
  }
  if (!["classic", "modern", "minimal"].includes(preset)) {
    const error = new Error("Choose a supported document appearance preset.");
    error.statusCode = 400;
    throw error;
  }
  if (!["rule", "plain", "accent"].includes(headerStyle) || !["rule", "plain"].includes(footerStyle)) {
    const error = new Error("Choose a supported header and footer style.");
    error.statusCode = 400;
    throw error;
  }
  const value = { themeColor, preset, headerStyle, footerStyle };
  await settings.doc("documentAppearance").set({
    ...value,
    updatedAt: new Date().toISOString(),
  });
  return value;
};
