/* Shadow Garden v2.1 route adapter — translation provenance lives in services/translations.js. */
import { handleTranslationsPost } from "../services/translations.js";

export async function onRequestPost(context){return handleTranslationsPost(context)}
