/* Shadow Garden R6 route adapter — upload validation/storage lives in services/admin.js. */
import { handleAdminUpload } from "../services/admin.js";

export async function onRequestPost(context) { return handleAdminUpload(context); }
