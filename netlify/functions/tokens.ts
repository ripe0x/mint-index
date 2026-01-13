import type { Context } from "@netlify/functions";
import { fetchAllTokens, TokenDataAPI } from "./lib/fetchTokens";

// In-memory cache
let cachedTokens: TokenDataAPI[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export default async function handler(request: Request, context: Context) {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  try {
    const now = Date.now();
    const cacheAge = now - cacheTimestamp;
    const isCacheValid = cachedTokens !== null && cacheAge < CACHE_TTL_MS;

    if (!isCacheValid) {
      console.log("[tokens] Cache miss or expired, fetching fresh data...");
      const startTime = Date.now();
      cachedTokens = await fetchAllTokens();
      cacheTimestamp = now;
      console.log(`[tokens] Fetched ${cachedTokens.length} tokens in ${Date.now() - startTime}ms`);
    } else {
      console.log(`[tokens] Cache hit, age: ${Math.round(cacheAge / 1000)}s`);
    }

    return new Response(JSON.stringify(cachedTokens), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": `public, max-age=${Math.floor(CACHE_TTL_MS / 1000)}, s-maxage=${Math.floor(CACHE_TTL_MS / 1000)}`,
        "X-Cache-Age": `${Math.round(cacheAge / 1000)}`,
        "X-Cache-Status": isCacheValid ? "HIT" : "MISS",
      },
    });
  } catch (error) {
    console.error("[tokens] Error fetching tokens:", error);

    // Return stale cache if available
    if (cachedTokens !== null) {
      console.log("[tokens] Returning stale cache due to error");
      return new Response(JSON.stringify(cachedTokens), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "X-Cache-Status": "STALE",
        },
      });
    }

    return new Response(JSON.stringify({ error: "Failed to fetch tokens" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}
