/* Shadow Garden v2.9 route adapter — recovery readiness is read-only and service-owned. */
import { handleRecoveryGet } from "../services/recovery.js";

export async function onRequestGet(context) { return handleRecoveryGet(context); }
