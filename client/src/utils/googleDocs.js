import { DOCX_MIME } from "./letterTemplates";

// OAuth web client ID from Google Cloud Console (APIs & Services > Credentials).
// The drive.file scope only grants access to files this app creates.
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPE = "https://www.googleapis.com/auth/drive.file";

let accessToken = null;
let tokenExpiresAt = 0;
let scriptPromise = null;

export const isGoogleDocsConfigured = () => Boolean(CLIENT_ID);

export const hasValidGoogleToken = () =>
  Boolean(accessToken) && Date.now() < tokenExpiresAt - 60000;

const loadGoogleIdentity = () => {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.onload = resolve;
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error("Unable to load Google sign-in."));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
};

const requestAccessToken = async () => {
  if (hasValidGoogleToken()) return accessToken;
  await loadGoogleIdentity();
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }
        accessToken = response.access_token;
        tokenExpiresAt = Date.now() + Number(response.expires_in) * 1000;
        resolve(accessToken);
      },
      error_callback: (error) =>
        reject(new Error(error.message || "Google sign-in was cancelled.")),
    });
    client.requestAccessToken();
  });
};

// Uploads the .docx to the signed-in user's Google Drive, converted to a Google Doc.
export const createGoogleDoc = async (name, docxBlob) => {
  const token = await requestAccessToken();
  const boundary = `hrms-${Date.now()}`;
  const metadata = { name, mimeType: "application/vnd.google-apps.document" };
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
    JSON.stringify(metadata),
    `\r\n--${boundary}\r\nContent-Type: ${DOCX_MIME}\r\n\r\n`,
    docxBlob,
    `\r\n--${boundary}--`,
  ]);

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  if (response.status === 401) accessToken = null;
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || "Unable to create the Google Doc.");
  }
  const file = await response.json();
  return file.webViewLink || `https://docs.google.com/document/d/${file.id}/edit`;
};
