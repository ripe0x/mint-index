import type { Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { fetchAllBounties, BountyDataAPI } from "./lib/fetchBounties";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const STORE_NAME = "bounties-cache";
const CACHE_KEY = "all-bounties";

interface CachedData {
  bounties: BountyDataAPI[];
  timestamp: number;
}

// In-memory cache as fast layer
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
      console.log(`[bounties] Memory cache hit, age: ${Math.round((now - memoryCache.timestamp) / 1000)}s`);
      return jsonResponse(memoryCache.bounties, "MEMORY_HIT", now - memoryCache.timestamp);
    }

    // Step 2: Check persistent blob storage
    let blobData: CachedData | null = null;
    try {
      const stored = await store.get(CACHE_KEY, { type: "json" }) as CachedData | null;
      if (stored) {
        blobData = stored;
        memoryCache = stored;
      }
    } catch (e) {
      console.log("[bounties] Blob read error:", e);
    }

    const blobAge = blobData ? now - blobData.timestamp : Infinity;
    const isBlobFresh = blobAge < CACHE_TTL_MS;

    // Step 3: If blob is fresh, return it
    if (blobData && isBlobFresh) {
      console.log(`[bounties] Blob cache hit, age: ${Math.round(blobAge / 1000)}s`);
      return jsonResponse(blobData.bounties, "BLOB_HIT", blobAge);
    }

    // Step 4: If blob exists but stale, return stale data AND refresh in background
    if (blobData) {
      console.log(`[bounties] Blob stale (age: ${Math.round(blobAge / 1000)}s), returning stale + background refresh`);
      context.waitUntil(refreshCache(store, now));
      return jsonResponse(blobData.bounties, "STALE_REFRESH", blobAge);
    }

    // Step 5: No cache at all - must fetch synchronously
    console.log("[bounties] No cache found, fetching synchronously...");
    const startTime = Date.now();
    const bounties = await fetchAllBounties();
    console.log(`[bounties] Fetched ${bounties.length} bounties in ${Date.now() - startTime}ms`);

    const newCache: CachedData = { bounties, timestamp: now };
    memoryCache = newCache;
    await store.setJSON(CACHE_KEY, newCache);

    return jsonResponse(bounties, "MISS", 0);

  } catch (error) {
    console.error("[bounties] Error:", error);

    if (memoryCache) {
      return jsonResponse(memoryCache.bounties, "ERROR_MEMORY", now - memoryCache.timestamp);
    }

    try {
      const stored = await store.get(CACHE_KEY, { type: "json" }) as CachedData | null;
      if (stored) {
        return jsonResponse(stored.bounties, "ERROR_BLOB", now - stored.timestamp);
      }
    } catch (e) {
      console.log("[bounties] Blob fallback failed:", e);
    }

    return new Response(JSON.stringify({ error: "Failed to fetch bounties" }), {
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
    console.log("[bounties] Background refresh starting...");
    const startTime = Date.now();
    const bounties = await fetchAllBounties();
    console.log(`[bounties] Background refresh: fetched ${bounties.length} bounties in ${Date.now() - startTime}ms`);

    const newCache: CachedData = { bounties, timestamp };
    memoryCache = newCache;
    await store.setJSON(CACHE_KEY, newCache);

    console.log("[bounties] Background refresh complete, cache updated");
  } catch (error) {
    console.error("[bounties] Background refresh failed:", error);
  }
}

function jsonResponse(bounties: BountyDataAPI[], cacheStatus: string, ageMs: number) {
  return new Response(JSON.stringify(bounties), {
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
