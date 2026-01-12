import type { Context } from "@netlify/functions";
import { fetchAllBounties, BountyDataAPI } from "./lib/fetchBounties";

// In-memory cache
let cachedBounties: BountyDataAPI[] | null = null;
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
    const isCacheValid = cachedBounties !== null && cacheAge < CACHE_TTL_MS;

    if (!isCacheValid) {
      console.log("[bounties] Cache miss or expired, fetching fresh data...");
      const startTime = Date.now();
      cachedBounties = await fetchAllBounties();
      cacheTimestamp = now;
      console.log(`[bounties] Fetched ${cachedBounties.length} bounties in ${Date.now() - startTime}ms`);
    } else {
      console.log(`[bounties] Cache hit, age: ${Math.round(cacheAge / 1000)}s`);
    }

    return new Response(JSON.stringify(cachedBounties), {
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
    console.error("[bounties] Error fetching bounties:", error);

    // Return stale cache if available
    if (cachedBounties !== null) {
      console.log("[bounties] Returning stale cache due to error");
      return new Response(JSON.stringify(cachedBounties), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "X-Cache-Status": "STALE",
        },
      });
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
