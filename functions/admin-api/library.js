/* Shadow Garden R6 route adapters — Library management lives in services/catalog.js. */
import { handleLibraryGet, handleLibraryPost } from "../services/catalog.js";

export async function onRequestGet(context) { return handleLibraryGet(context); }
export async function onRequestPost(context) { return handleLibraryPost(context); }
