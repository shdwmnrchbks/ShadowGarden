/* Shadow Garden R6 route adapter — status/storage checks live in services/admin.js. */
import { handleAdminStatus } from "../services/admin.js";

export async function onRequestPost(context) { return handleAdminStatus(context); }
