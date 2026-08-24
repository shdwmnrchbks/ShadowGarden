/* Shadow Garden R6 route adapter — catalog mutation lives in services/catalog.js. */
import { handleCatalogPost } from "../services/catalog.js";

export async function onRequestPost(context) { return handleCatalogPost(context); }
