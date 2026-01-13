import type { Context } from "@netlify/functions";
import { fetchTokenDetail, TokenDetailAPI } from "./lib/fetchToken";
import { Address } from "viem";

// In-memory cache for individual tokens
const tokenCache = new Map<string, { data: TokenDetailAPI; timestamp: number }>();
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes (shorter for individual tokens)

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

  // Expected path: /.netlify/functions/token/[contract]/[tokenId]
  // pathParts: ["api", "token", contract, tokenId] or [".netlify", "functions", "token", contract, tokenId]
  let contract: string | undefined;
  let tokenId: string | undefined;

  // Find "token" in path and get next two parts
  const tokenIndex = pathParts.findIndex(p => p === "token");
  if (tokenIndex !== -1 && pathParts.length > tokenIndex + 2) {
    contract = pathParts[tokenIndex + 1];
    tokenId = pathParts[tokenIndex + 2];
  }

  if (!contract || !tokenId) {
    return new Response(JSON.stringify({ error: "Missing contract or tokenId" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  // Validate contract address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(contract)) {
    return new Response(JSON.stringify({ error: "Invalid contract address" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  // Validate tokenId is a number
  const tokenIdNum = parseInt(tokenId, 10);
  if (isNaN(tokenIdNum) || tokenIdNum < 1) {
    return new Response(JSON.stringify({ error: "Invalid tokenId" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  const cacheKey = `${contract.toLowerCase()}-${tokenIdNum}`;

  try {
    const now = Date.now();
    const cached = tokenCache.get(cacheKey);
    const isCacheValid = cached && (now - cached.timestamp) < CACHE_TTL_MS;

    let tokenData: TokenDetailAPI | null;
    let cacheStatus: string;

    if (isCacheValid) {
      console.log(`[token] Cache hit for ${cacheKey}`);
      tokenData = cached.data;
      cacheStatus = "HIT";
    } else {
      console.log(`[token] Cache miss for ${cacheKey}, fetching...`);
      const startTime = Date.now();
      tokenData = await fetchTokenDetail(contract as Address, tokenIdNum);

      if (tokenData) {
        tokenCache.set(cacheKey, { data: tokenData, timestamp: now });
        console.log(`[token] Fetched token in ${Date.now() - startTime}ms`);
      }
      cacheStatus = "MISS";
    }

    if (!tokenData) {
      return new Response(JSON.stringify({ error: "Token not found" }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    return new Response(JSON.stringify(tokenData), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": `public, max-age=${Math.floor(CACHE_TTL_MS / 1000)}, s-maxage=${Math.floor(CACHE_TTL_MS / 1000)}`,
        "X-Cache-Status": cacheStatus,
      },
    });
  } catch (error) {
    console.error("[token] Error fetching token:", error);

    // Return stale cache if available
    const cached = tokenCache.get(cacheKey);
    if (cached) {
      console.log("[token] Returning stale cache due to error");
      return new Response(JSON.stringify(cached.data), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "X-Cache-Status": "STALE",
        },
      });
    }

    return new Response(JSON.stringify({ error: "Failed to fetch token" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}
