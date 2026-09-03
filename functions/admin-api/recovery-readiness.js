/* Shadow Garden v2.9 route adapter — recovery readiness is read-only and report-owned. */
import { handleRecoveryReadinessGet } from "../services/recovery-readiness.js";

export async function onRequestGet(context) { return handleRecoveryReadinessGet(context); }
