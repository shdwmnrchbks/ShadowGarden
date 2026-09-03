/* Shadow Garden v2.9 route adapter — bulk artwork behavior lives in services/artwork.js. */
import { handleArtworkPost } from "../services/artwork.js";

export async function onRequestPost(context) { return handleArtworkPost(context); }
