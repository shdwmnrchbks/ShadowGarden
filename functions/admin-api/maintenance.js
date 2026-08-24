/* Shadow Garden R6 route adapters — Garden Maintenance lives in services/catalog.js + validation.js. */
import { handleMaintenanceGet, handleMaintenancePost } from "../services/catalog.js";

export async function onRequestGet(context) { return handleMaintenanceGet(context); }
export async function onRequestPost(context) { return handleMaintenancePost(context); }
