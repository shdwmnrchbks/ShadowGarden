/* Shadow Garden v2.9 route adapters — Maintenance mutations remain catalog-owned behind recovery safety checks. */
import { handleMaintenanceGet } from "../services/catalog.js";
import { handleGuardedMaintenancePost } from "../services/recovery.js";

export async function onRequestGet(context) { return handleMaintenanceGet(context); }
export async function onRequestPost(context) { return handleGuardedMaintenancePost(context); }
