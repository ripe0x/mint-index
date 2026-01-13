import type { Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { fetchAllTokens, TokenDataAPI } from "./lib/fetchTokens";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const STORE_NAME = "tokens-cache";
const CACHE_KEY = "all-tokens";

interface CachedData {
  tokens: TokenDataAPI[];
  timestamp: number;
}

// In-memory cache as fast layer (still useful within single invocation)
let memoryCache: CachedData | null = null;

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

  const store = getStore(STORE_NAME);
  const now = Date.now();

  try {
    // Step 1: Check memory cache first (fastest)
    if (memoryCache && (now - memoryCache.timestamp) < CACHE_TTL_MS) {
      console.log(`[tokens] Memory cache hit, age: ${Math.round((now - memoryCache.timestamp) / 1000)}s`);
      return jsonResponse(memoryCache.tokens, "MEMORY_HIT", now - memoryCache.timestamp);
    }

    // Step 2: Check persistent blob storage
    let blobData: CachedData | null = null;
    try {
      const stored = await store.get(CACHE_KEY, { type: "json" }) as CachedData | null;
      if (stored) {
        blobData = stored;
        memoryCache = stored; // Populate memory cache
      }
    } catch (e) {
      console.log("[tokens] Blob read error:", e);
    }

    const blobAge = blobData ? now - blobData.timestamp : Infinity;
    const isBlobFresh = blobAge < CACHE_TTL_MS;

    // Step 3: If blob is fresh, return it
    if (blobData && isBlobFresh) {
      console.log(`[tokens] Blob cache hit, age: ${Math.round(blobAge / 1000)}s`);
      return jsonResponse(blobData.tokens, "BLOB_HIT", blobAge);
    }

    // Step 4: If blob exists but stale, return stale data AND refresh in background
    if (blobData) {
      console.log(`[tokens] Blob stale (age: ${Math.round(blobAge / 1000)}s), returning stale + background refresh`);

      // Trigger background refresh (non-blocking)
      context.waitUntil(refreshCache(store, now));

      return jsonResponse(blobData.tokens, "STALE_REFRESH", blobAge);
    }

    // Step 5: No cache at all - must fetch synchronously (only happens on first deploy)
    console.log("[tokens] No cache found, fetching synchronously...");
    const startTime = Date.now();
    const tokens = await fetchAllTokens();
    console.log(`[tokens] Fetched ${tokens.length} tokens in ${Date.now() - startTime}ms`);

    // Save to blob and memory
    const newCache: CachedData = { tokens, timestamp: now };
    memoryCache = newCache;
    await store.setJSON(CACHE_KEY, newCache);

    return jsonResponse(tokens, "MISS", 0);

  } catch (error) {
    console.error("[tokens] Error:", error);

    // Try to return any cached data on error
    if (memoryCache) {
      return jsonResponse(memoryCache.tokens, "ERROR_MEMORY", now - memoryCache.timestamp);
    }

    try {
      const stored = await store.get(CACHE_KEY, { type: "json" }) as CachedData | null;
      if (stored) {
        return jsonResponse(stored.tokens, "ERROR_BLOB", now - stored.timestamp);
      }
    } catch (e) {
      console.log("[tokens] Blob fallback failed:", e);
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

async function refreshCache(store: ReturnType<typeof getStore>, timestamp: number) {
  try {
    console.log("[tokens] Background refresh starting...");
    const startTime = Date.now();
    const tokens = await fetchAllTokens();
    console.log(`[tokens] Background refresh: fetched ${tokens.length} tokens in ${Date.now() - startTime}ms`);

    const newCache: CachedData = { tokens, timestamp };
    memoryCache = newCache;
    await store.setJSON(CACHE_KEY, newCache);

    console.log("[tokens] Background refresh complete, cache updated");
  } catch (error) {
    console.error("[tokens] Background refresh failed:", error);
  }
}

function jsonResponse(tokens: TokenDataAPI[], cacheStatus: string, ageMs: number) {
  return new Response(JSON.stringify(tokens), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": `public, max-age=${Math.floor(CACHE_TTL_MS / 1000)}, s-maxage=${Math.floor(CACHE_TTL_MS / 1000)}`,
      "X-Cache-Age": `${Math.round(ageMs / 1000)}`,
      "X-Cache-Status": cacheStatus,
    },
  });
}
