/**
 * Firebase Cloud Storage utilities for HRMS personnel files.
 * All storage operations are server-side only (Admin SDK).
 */
import { storageBucket } from "../config/firebase.js";
import { v4 as uuidv4 } from "uuid";

/**
 * Upload a Buffer to Cloud Storage.
 * @returns {{ storagePath, storageUrl, size }}
 */
export const uploadToStorage = async (buffer, storagePath, contentType = "application/octet-stream") => {
  const file = storageBucket.file(storagePath);
  await file.save(buffer, {
    metadata: { contentType },
    resumable: false,
  });
  return {
    storagePath,
    // Public URL is not used (bucket is private); use signed URLs for downloads.
    size: buffer.length,
  };
};

/**
 * Generate a signed download URL valid for `expiresMinutes` (default 30).
 */
export const generateSignedUrl = async (storagePath, expiresMinutes = 30) => {
  const file = storageBucket.file(storagePath);
  const expires = Date.now() + expiresMinutes * 60 * 1000;
  const [url] = await file.getSignedUrl({
    action: "read",
    expires,
  });
  return url;
};

/**
 * Delete a file from Cloud Storage. Silently succeeds if the file does not exist.
 */
export const deleteFromStorage = async (storagePath) => {
  try {
    const file = storageBucket.file(storagePath);
    await file.delete();
  } catch (err) {
    if (err.code !== 404) throw err;
    // File already gone — that's fine.
  }
};

/**
 * Build the standard storage path for a personnel document.
 * Pattern: employees/{employeeId}/documents/{uuid}/{sanitizedFileName}
 */
export const buildPersonnelDocPath = (employeeId, fileName) => {
  const id = uuidv4();
  const safe = (fileName || "document").replace(/[^a-zA-Z0-9._-]/g, "_");
  return `employees/${employeeId}/documents/${id}/${safe}`;
};

/**
 * Build the storage path for an identity document image.
 */
export const buildIdentityDocPath = (employeeId, fileName) => {
  const id = uuidv4();
  const safe = (fileName || "identity").replace(/[^a-zA-Z0-9._-]/g, "_");
  return `employees/${employeeId}/identity/${id}/${safe}`;
};

/**
 * Check whether the Cloud Storage bucket is reachable.
 * @returns {boolean}
 */
export const verifyStorageBucket = async () => {
  const [exists] = await storageBucket.exists();
  return exists;
};
