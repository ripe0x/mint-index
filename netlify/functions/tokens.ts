import type { Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { fetchTokensIncremental, CachedTokensData, TokenDataAPI } from "./lib/fetchTokens";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const STORE_NAME = "tokens-cache";
const CACHE_KEY = "all-tokens-v2"; // New key for new format

interface StoredData {
  data: CachedTokensData;
  timestamp: number;
}

// In-memory cache as fast layer
let memoryCache: StoredData | null = null;

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
      return jsonResponse(memoryCache.data.tokens, "MEMORY_HIT", now - memoryCache.timestamp);
    }

    // Step 2: Check persistent blob storage
    let blobData: StoredData | null = null;
    try {
      const stored = await store.get(CACHE_KEY, { type: "json" }) as StoredData | null;
      if (stored) {
        blobData = stored;
        memoryCache = stored;
      }
    } catch (e) {
      console.log("[tokens] Blob read error:", e);
    }

    const blobAge = blobData ? now - blobData.timestamp : Infinity;
    const isBlobFresh = blobAge < CACHE_TTL_MS;

    // Step 3: If blob is fresh, return it
    if (blobData && isBlobFresh) {
      console.log(`[tokens] Blob cache hit, age: ${Math.round(blobAge / 1000)}s, ${blobData.data.tokens.length} tokens`);
      return jsonResponse(blobData.data.tokens, "BLOB_HIT", blobAge);
    }

    // Step 4: If blob exists but stale, return stale data AND refresh in background (INCREMENTAL)
    if (blobData) {
      console.log(`[tokens] Blob stale (age: ${Math.round(blobAge / 1000)}s), returning stale + incremental refresh`);
      context.waitUntil(refreshCacheIncremental(store, blobData.data, now));
      return jsonResponse(blobData.data.tokens, "STALE_REFRESH", blobAge);
    }

    // Step 5: No cache at all - fetch in background, return empty immediately
    // This prevents timeout on first deploy
    console.log("[tokens] No cache found, starting background fetch...");
    context.waitUntil(
      (async () => {
        try {
          const startTime = Date.now();
          const freshData = await fetchTokensIncremental(undefined);
          console.log(`[tokens] Background full fetch: ${freshData.tokens.length} tokens in ${Date.now() - startTime}ms`);
          const newStored: StoredData = { data: freshData, timestamp: Date.now() };
          memoryCache = newStored;
          await store.setJSON(CACHE_KEY, newStored);
        } catch (error) {
          console.error("[tokens] Background full fetch failed:", error);
        }
      })()
    );

    // Return empty array with header indicating cache is warming up
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache",
        "X-Cache-Status": "WARMING_UP",
        "X-Token-Count": "0",
      },
    });

  } catch (error) {
    console.error("[tokens] Error:", error);

    // Try to return any cached data on error
    if (memoryCache) {
      return jsonResponse(memoryCache.data.tokens, "ERROR_MEMORY", now - memoryCache.timestamp);
    }

    try {
      const stored = await store.get(CACHE_KEY, { type: "json" }) as StoredData | null;
      if (stored) {
        return jsonResponse(stored.data.tokens, "ERROR_BLOB", now - stored.timestamp);
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

async function refreshCacheIncremental(
  store: ReturnType<typeof getStore>,
  existingData: CachedTokensData,
  timestamp: number
) {
  try {
    console.log("[tokens] Incremental refresh starting...");
    const startTime = Date.now();

    // Incremental fetch - only get new tokens
    const freshData = await fetchTokensIncremental(existingData);

    const newTokenCount = freshData.tokens.length - existingData.tokens.length;
    console.log(`[tokens] Incremental refresh: ${newTokenCount} new tokens in ${Date.now() - startTime}ms`);

    const newStored: StoredData = { data: freshData, timestamp };
    memoryCache = newStored;
    await store.setJSON(CACHE_KEY, newStored);

    console.log(`[tokens] Incremental refresh complete, total: ${freshData.tokens.length} tokens`);
  } catch (error) {
    console.error("[tokens] Incremental refresh failed:", error);
  }
}

function jsonResponse(tokens: TokenDataAPI[], cacheStatus: string, ageMs: number) {
  return new Response(JSON.stringify(tokens), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Expose-Headers": "X-Cache-Age, X-Cache-Status, X-Token-Count",
      "Cache-Control": `public, max-age=${Math.floor(CACHE_TTL_MS / 1000)}, s-maxage=${Math.floor(CACHE_TTL_MS / 1000)}`,
      "X-Cache-Age": `${Math.round(ageMs / 1000)}`,
      "X-Cache-Status": cacheStatus,
      "X-Token-Count": `${tokens.length}`,
    },
  });
}
