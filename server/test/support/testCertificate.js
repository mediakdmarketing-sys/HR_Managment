// Creates a throwaway self-signed certificate for localhost at test time (nothing is
// committed) and trusts it for this test process only, so TLS tests run with full
// certificate verification instead of disabling it. Returns null when openssl is
// unavailable; callers then skip TLS-dependent tests.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import tls from "node:tls";

let cached;

// Generates a new self-signed localhost certificate; null if openssl is unavailable.
export const generateCertificate = () => {
  const directory = mkdtempSync(join(tmpdir(), "hrms-mail-tls-"));
  try {
    const keyPath = join(directory, "key.pem");
    const certPath = join(directory, "cert.pem");
    const result = spawnSync("openssl", [
      "req", "-x509", "-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:prime256v1", "-nodes",
      "-keyout", keyPath, "-out", certPath, "-days", "1", "-subj", "/CN=localhost",
      "-addext", "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1",
    ], { env: { ...process.env, MSYS_NO_PATHCONV: "1" }, encoding: "utf8" });
    if (result.status !== 0) return null;
    return { key: readFileSync(keyPath, "utf8"), cert: readFileSync(certPath, "utf8") };
  } catch {
    return null;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

// A certificate trusted by this test process (added to its default CA list).
export const getTestCertificate = () => {
  if (cached !== undefined) return cached;
  cached = generateCertificate();
  if (cached) tls.setDefaultCACertificates([...tls.getCACertificates("default"), cached.cert]);
  return cached;
};
