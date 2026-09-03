/* Shadow Garden R6 — canonical private Backblaze B2 storage service. */
import { AwsClient } from "aws4fetch";

export const B2_BUCKET = "shadow-garden-books-01";
export const B2_ENDPOINT = "https://s3.us-east-005.backblazeb2.com";
export const B2_REGION = "us-east-005";
export const ROOT_PREFIX = "shadow-garden/";
export const BACKUP_SHA256_HEADER = "x-amz-meta-shadow-garden-sha256";
export const BACKUP_BYTES_HEADER = "x-amz-meta-shadow-garden-bytes";
const CATALOG_BACKUP_PREFIX = "shadow-garden/backups/catalogs/";

export function encodeKey(key) {
  return String(key || "").split("/").map(encodeURIComponent).join("/");
}

export function validObjectKey(key, prefixes = [ROOT_PREFIX]) {
  const value = String(key || "");
  if (!value || value.includes("\\") || value.split("/").some(part => part === "." || part === "..")) return false;
  return prefixes.some(prefix => value.startsWith(prefix));
}

export function objectUrl(key) {
  return `${B2_ENDPOINT}/${B2_BUCKET}/${encodeKey(key)}`;
}

function client(accessKeyId, secretAccessKey) {
  return new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: B2_REGION, retries: 2 });
}

export function readClient(env) {
  if (!env.B2_READ_KEY_ID || !env.B2_READ_APPLICATION_KEY) throw new Error("B2 read credentials are not configured.");
  return client(env.B2_READ_KEY_ID, env.B2_READ_APPLICATION_KEY);
}

export function writeClient(env) {
  if (!env.B2_WRITE_KEY_ID || !env.B2_WRITE_APPLICATION_KEY) throw new Error("B2 write credentials are not configured.");
  return client(env.B2_WRITE_KEY_ID, env.B2_WRITE_APPLICATION_KEY);
}

function utf8Bytes(value) { return new TextEncoder().encode(String(value ?? "")); }

export async function sha256Text(value) {
  const digest = await crypto.subtle.digest("SHA-256", utf8Bytes(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function getTextObjectWithIntegrity(aws, key) {
  const response = await aws.fetch(objectUrl(key), { method: "GET" });
  if (response.status === 404) return { text: null, integrity: { present: false, hasChecksum: false, checksumMatches: false, sizeMatches: false, actualBytes: 0 } };
  if (!response.ok) throw new Error(`B2 GET ${key} failed (${response.status}): ${await response.text()}`);
  const text = await response.text(), actualBytes = utf8Bytes(text).byteLength;
  const expectedSha256 = String(response.headers.get(BACKUP_SHA256_HEADER) || "").trim().toLowerCase();
  const expectedBytesRaw = String(response.headers.get(BACKUP_BYTES_HEADER) || "").trim();
  const parsedExpectedBytes = Number(expectedBytesRaw), expectedBytes = Number.isSafeInteger(parsedExpectedBytes) && parsedExpectedBytes >= 0 ? parsedExpectedBytes : null;
  const hasChecksum = /^[a-f0-9]{64}$/.test(expectedSha256), actualSha256 = hasChecksum ? await sha256Text(text) : "";
  return { text, integrity: {
    present: true, hasChecksum, expectedSha256: hasChecksum ? expectedSha256 : "", actualSha256,
    checksumMatches: hasChecksum ? actualSha256 === expectedSha256 : false,
    expectedBytes, actualBytes, sizeMatches: expectedBytes === null ? null : actualBytes === expectedBytes
  }};
}

export async function getTextObject(aws, key) {
  const result = await getTextObjectWithIntegrity(aws, key);
  if (result.text === null) return null;
  if (result.integrity.hasChecksum && !result.integrity.checksumMatches) throw new Error(`B2 integrity check failed for ${key}: SHA-256 checksum mismatch`);
  if (result.integrity.expectedBytes !== null && result.integrity.sizeMatches === false) throw new Error(`B2 integrity check failed for ${key}: byte length mismatch`);
  return result.text;
}

export async function headObject(aws, key) {
  if (!validObjectKey(key)) return false;
  const response = await aws.fetch(objectUrl(key), { method: "HEAD" });
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`B2 HEAD ${key} failed (${response.status}): ${await response.text()}`);
  return true;
}

export async function putObject(aws, key, body, headers = {}) {
  if (!validObjectKey(key)) throw new Error("Refusing to write an object outside the Shadow Garden prefix.");
  const nextHeaders = new Headers(headers);
  if (String(key).startsWith(CATALOG_BACKUP_PREFIX) && typeof body === "string") {
    nextHeaders.set(BACKUP_SHA256_HEADER, await sha256Text(body));
    nextHeaders.set(BACKUP_BYTES_HEADER, String(utf8Bytes(body).byteLength));
  }
  const response = await aws.fetch(objectUrl(key), { method: "PUT", body, headers: nextHeaders });
  if (!response.ok) throw new Error(`B2 PUT ${key} failed (${response.status}): ${await response.text()}`);
  return response;
}

export async function deleteObject(aws, key) {
  if (!validObjectKey(key)) throw new Error("Refusing to delete an object outside the Shadow Garden prefix.");
  const response = await aws.fetch(objectUrl(key), { method: "DELETE" });
  if (response.status === 404) return response;
  if (!response.ok) throw new Error(`B2 DELETE ${key} failed (${response.status}): ${await response.text()}`);
  return response;
}

export function storageConfiguration(env) {
  const required = ["B2_WRITE_KEY_ID", "B2_WRITE_APPLICATION_KEY", "B2_READ_KEY_ID", "B2_READ_APPLICATION_KEY"];
  const missing = required.filter(name => !env[name]);
  return { configured: missing.length === 0, missing, bucket: B2_BUCKET };
}
