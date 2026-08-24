/* Shadow Garden R6 route adapter — media authorization/proxying lives in services/media.js. */
import { handleMediaRequest } from "../services/media.js";

export async function onRequest(context) { return handleMediaRequest(context); }
