/* Shadow Garden R6 route adapter — catalog backup deletion lives in services/catalog.js. */
import { handleBackupPost } from "../services/catalog.js";

export async function onRequestPost(context) { return handleBackupPost(context); }
