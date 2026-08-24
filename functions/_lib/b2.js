/* R6 compatibility facade. Ownership moved to services/storage.js, auth.js, and http.js. */
export {
  B2_BUCKET,
  B2_ENDPOINT,
  B2_REGION,
  ROOT_PREFIX,
  encodeKey,
  validObjectKey,
  objectUrl,
  readClient,
  writeClient,
  getTextObject,
  headObject,
  putObject,
  deleteObject,
  storageConfiguration
} from "../services/storage.js";
export { adminTokenMatches, adminAuthorized } from "../services/auth.js";
export { json } from "../services/http.js";
