/* Shadow Garden R6 route adapters — series banner behavior lives in services/catalog.js. */
import { handleSeriesBannerGet, handleSeriesBannerPost } from "../services/catalog.js";

export async function onRequestGet(context) { return handleSeriesBannerGet(context); }
export async function onRequestPost(context) { return handleSeriesBannerPost(context); }
