import { AwsClient } from "aws4fetch";

export const B2_BUCKET = "shadow-garden-books-01";
export const B2_ENDPOINT = "https://s3.us-east-005.backblazeb2.com";
export const B2_REGION = "us-east-005";
export const ROOT_PREFIX = "shadow-garden/";

const encoder = new TextEncoder();

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
  return new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: "s3",
    region: B2_REGION,
    retries: 2
  });
}

export function readClient(env) {
  if (!env.B2_READ_KEY_ID || !env.B2_READ_APPLICATION_KEY) {
    throw new Error("B2 read credentials are not configured.");
  }
  return client(env.B2_READ_KEY_ID, env.B2_READ_APPLICATION_KEY);
}

export function writeClient(env) {
  if (!env.B2_WRITE_KEY_ID || !env.B2_WRITE_APPLICATION_KEY) {
    throw new Error("B2 write credentials are not configured.");
  }
  return client(env.B2_WRITE_KEY_ID, env.B2_WRITE_APPLICATION_KEY);
}

async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(String(value || ""))));
}

export async function adminAuthorized(request, env) {
  if (!env.SG_ADMIN_TOKEN) return false;
  const auth = request.headers.get("authorization") || "";
  const supplied = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!supplied) return false;
  const [a, b] = await Promise.all([digest(supplied), digest(env.SG_ADMIN_TOKEN)]);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers }
  });
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
