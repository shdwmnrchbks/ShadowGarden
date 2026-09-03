/* Shadow Garden v2.9 route adapter — recovery readiness and emergency restore are service-owned. */
import { handleRecoveryGet, handleRecoveryPost } from "../services/recovery.js";

export async function onRequestGet(context) { return handleRecoveryGet(context); }
export async function onRequestPost(context) { return handleRecoveryPost(context); }
