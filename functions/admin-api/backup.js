/* Shadow Garden v2.9 route adapter — catalog backup deletion remains catalog-owned behind recovery safety checks. */
import { handleGuardedBackupPost } from "../services/recovery.js";

export async function onRequestPost(context) { return handleGuardedBackupPost(context); }
