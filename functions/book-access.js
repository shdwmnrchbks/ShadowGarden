/* Shadow Garden R6 route adapter — book authorization lives in services/media.js. */
import { handleBookAccess } from "./services/media.js";

export async function onRequest(context) { return handleBookAccess(context); }
