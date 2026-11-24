import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import mammoth from "mammoth";

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const EXTENSIONS = new Set([".pdf", ".docx", ".txt"]);

export const validateResumeUpload = ({ fileName, base64, contentType }) => {
  if (!fileName || typeof fileName !== "string" || !base64 || typeof base64 !== "string") {
    throw Object.assign(new Error("Resume file name and content are required"), { code: "INVALID_FILE" });
  }
  const extension = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  if (!EXTENSIONS.has(extension)) {
    throw Object.assign(new Error("Only PDF, DOCX and TXT resumes are supported"), { code: "INVALID_FILE_TYPE" });
  }
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) {
    throw Object.assign(new Error("Resume content must be valid base64"), { code: "INVALID_FILE" });
  }
  const bytes = Buffer.from(base64, "base64");
  if (!bytes.length || bytes.length > MAX_RESUME_BYTES) {
    throw Object.assign(new Error("Resume files must be between 1 byte and 5 MB"), { code: "INVALID_FILE_SIZE" });
  }
  const validSignature =
    (extension === ".pdf" && bytes.subarray(0, 5).toString() === "%PDF-") ||
    (extension === ".docx" && bytes.subarray(0, 2).toString() === "PK") ||
    extension === ".txt";
  if (!validSignature) {
    throw Object.assign(new Error("Resume content does not match its file type"), { code: "INVALID_FILE_TYPE" });
  }
  const allowedTypes = {
    ".pdf": ["application/pdf", "application/octet-stream"],
    ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/octet-stream"],
    ".txt": ["text/plain", "application/octet-stream"],
  };
  if (contentType && !allowedTypes[extension].includes(contentType)) {
    throw Object.assign(new Error("Resume content type does not match its file type"), { code: "INVALID_FILE_TYPE" });
  }
  return {
    bytes,
    extension,
    safeName: fileName.split(/[\\/]/).pop().replace(/[^a-zA-Z0-9._-]/g, "_"),
  };
};

export const extractResumeText = async (bytes, extension) => {
  if (extension === ".txt") return bytes.toString("utf8").slice(0, 200_000);
  if (extension === ".docx") {
    const result = await mammoth.extractRawText({ buffer: bytes });
    return result.value.slice(0, 200_000);
  }

  const pdf = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str || "").join(" "));
  }
  return pages.join("\n").slice(0, 200_000);
};
