// Human-readable status for stored mailbox passwords, from the server's non-secret
// passwordStorage / encryptionKeyStatus fields. Never receives or shows a password.

// A password the server can actually use ("unreadable" means it is stored but cannot be
// decrypted with the current key).
export const isPasswordUsable = (section = {}) =>
  Boolean(section.hasPassword) && section.passwordStorage !== "unreadable";

export const passwordWarning = (section = {}) => {
  if (section.passwordStorage === "unreadable") {
    return "The saved password can't be decrypted with the server's current encryption key. Enter the password again and save.";
  }
  if (section.passwordStorage === "unencrypted") {
    return "The saved password is not encrypted yet. Save these settings once to encrypt it.";
  }
  return "";
};

export const encryptionKeyWarning = (status) => ({
  "restart-required": "The encryption key in the server .env file changed after the server started. Restart the server before saving passwords.",
  missing: "The server has no RECRUITMENT_CREDENTIALS_KEY, so passwords can't be saved. Set it in the server environment and restart.",
  invalid: "The server's RECRUITMENT_CREDENTIALS_KEY is not a valid 32-byte key. Fix it in the server environment and restart.",
}[status] || "");
