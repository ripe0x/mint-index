import type { Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { fetchTokenDetail, TokenDetailAPI } from "./lib/fetchToken";
import { Address } from "viem";

const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
const STORE_NAME = "token-cache";

interface CachedData {
  data: TokenDetailAPI;
  timestamp: number;
}

// In-memory cache as fast layer
const memoryCache = new Map<string, CachedData>();

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

  // Parse URL to get contract and tokenId
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/").filter(Boolean);

  let contract: string | undefined;
  let tokenId: string | undefined;

  const tokenIndex = pathParts.findIndex(p => p === "token");
  if (tokenIndex !== -1 && pathParts.length > tokenIndex + 2) {
    contract = pathParts[tokenIndex + 1];
    tokenId = pathParts[tokenIndex + 2];
  }

  if (!contract || !tokenId) {
    return errorResponse("Missing contract or tokenId", 400);
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(contract)) {
    return errorResponse("Invalid contract address", 400);
  }

  const tokenIdNum = parseInt(tokenId, 10);
  if (isNaN(tokenIdNum) || tokenIdNum < 1) {
    return errorResponse("Invalid tokenId", 400);
  }

  const cacheKey = `${contract.toLowerCase()}-${tokenIdNum}`;
  const store = getStore(STORE_NAME);
  const now = Date.now();

  try {
    // Step 1: Check memory cache
    const memoryCached = memoryCache.get(cacheKey);
    if (memoryCached && (now - memoryCached.timestamp) < CACHE_TTL_MS) {
      console.log(`[token] Memory cache hit for ${cacheKey}`);
      return jsonResponse(memoryCached.data, "MEMORY_HIT", now - memoryCached.timestamp);
    }

    // Step 2: Check blob storage
    let blobData: CachedData | null = null;
    try {
      const stored = await store.get(cacheKey, { type: "json" }) as CachedData | null;
      if (stored) {
        blobData = stored;
        memoryCache.set(cacheKey, stored);
      }
    } catch (e) {
      console.log(`[token] Blob read error for ${cacheKey}:`, e);
    }

    const blobAge = blobData ? now - blobData.timestamp : Infinity;
    const isBlobFresh = blobAge < CACHE_TTL_MS;

    // Step 3: If blob is fresh, return it
    if (blobData && isBlobFresh) {
      console.log(`[token] Blob cache hit for ${cacheKey}, age: ${Math.round(blobAge / 1000)}s`);
      return jsonResponse(blobData.data, "BLOB_HIT", blobAge);
    }

    // Step 4: If blob exists but stale, return stale + background refresh
    if (blobData) {
      console.log(`[token] Blob stale for ${cacheKey}, returning stale + background refresh`);
      context.waitUntil(refreshCache(store, cacheKey, contract as Address, tokenIdNum, now));
      return jsonResponse(blobData.data, "STALE_REFRESH", blobAge);
    }

    // Step 5: No cache - fetch synchronously
    console.log(`[token] No cache for ${cacheKey}, fetching...`);
    const startTime = Date.now();
    const tokenData = await fetchTokenDetail(contract as Address, tokenIdNum);

    if (!tokenData) {
      return errorResponse("Token not found", 404);
    }

    console.log(`[token] Fetched ${cacheKey} in ${Date.now() - startTime}ms`);

    const newCache: CachedData = { data: tokenData, timestamp: now };
    memoryCache.set(cacheKey, newCache);
    await store.setJSON(cacheKey, newCache);

    return jsonResponse(tokenData, "MISS", 0);

  } catch (error) {
    console.error(`[token] Error for ${cacheKey}:`, error);

    // Try memory cache
    const memoryCached = memoryCache.get(cacheKey);
    if (memoryCached) {
      return jsonResponse(memoryCached.data, "ERROR_MEMORY", now - memoryCached.timestamp);
    }

    // Try blob
    try {
      const stored = await store.get(cacheKey, { type: "json" }) as CachedData | null;
      if (stored) {
        return jsonResponse(stored.data, "ERROR_BLOB", now - stored.timestamp);
      }
    } catch (e) {
      console.log(`[token] Blob fallback failed for ${cacheKey}:`, e);
    }

    return errorResponse("Failed to fetch token", 500);
  }
}

async function refreshCache(
  store: ReturnType<typeof getStore>,
  cacheKey: string,
  contract: Address,
  tokenId: number,
  timestamp: number
) {
  try {
    console.log(`[token] Background refresh for ${cacheKey}...`);
    const startTime = Date.now();
    const tokenData = await fetchTokenDetail(contract, tokenId);

    if (tokenData) {
      const newCache: CachedData = { data: tokenData, timestamp };
      memoryCache.set(cacheKey, newCache);
      await store.setJSON(cacheKey, newCache);
      console.log(`[token] Background refresh complete for ${cacheKey} in ${Date.now() - startTime}ms`);
    }
  } catch (error) {
    console.error(`[token] Background refresh failed for ${cacheKey}:`, error);
  }
}

function jsonResponse(data: TokenDetailAPI, cacheStatus: string, ageMs: number) {
  return new Response(JSON.stringify(data), {
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

function errorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
