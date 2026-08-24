/* Shadow Garden R6 route adapter — authentication logic lives in services/auth.js. */
import { ADMIN_ACCESS_ACTION, handleAdminAccess } from "./services/auth.js";

export { ADMIN_ACCESS_ACTION };
export async function onRequest(context) { return handleAdminAccess(context); }
