/* Shadow Garden R6 route adapter — abuse review/release lives in services/abuse.js. */
import { handleAbuseAdmin } from "../services/abuse.js";

export async function onRequest(context) { return handleAbuseAdmin(context); }
