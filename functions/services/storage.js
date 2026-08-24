/* Shadow Garden R6 — canonical private Backblaze B2 storage service. */
import { AwsClient } from "aws4fetch";

export const B2_BUCKET = "shadow-garden-books-01";
export const B2_ENDPOINT = "https://s3.us-east-005.backblazeb2.com";
export const B2_REGION = "us-east-005";
export const ROOT_PREFIX = "shadow-garden/";

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

export async function getTextObject(aws, key) {
  const response = await aws.fetch(objectUrl(key), { method: "GET" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`B2 GET ${key} failed (${response.status}): ${await response.text()}`);
  return response.text();
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
  const response = await aws.fetch(objectUrl(key), { method: "PUT", body, headers });
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
