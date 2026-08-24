/* Shadow Garden R6 route adapter — human verification lives in services/auth.js. */
import { handleHumanAccess } from "./services/auth.js";

export async function onRequest(context) { return handleHumanAccess(context); }
