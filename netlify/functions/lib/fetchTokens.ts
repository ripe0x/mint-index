import { createPublicClient, http, Address, parseAbiItem } from "viem";
import { mainnet, sepolia } from "viem/chains";

const tokenAbi = [
  {
    type: "function",
    name: "latestTokenId",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "get",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      { name: "name", type: "string" },
      { name: "description", type: "string" },
      { name: "artifact", type: "address[]" },
      { name: "renderer", type: "uint32" },
      { name: "mintedBlock", type: "uint32" },
      { name: "closeAt", type: "uint64" },
      { name: "data", type: "uint128" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "uri",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "mintOpenUntil",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

const FACTORY_ADDRESS_MAINNET = "0xd717Fe677072807057B03705227EC3E3b467b670" as Address;
const FACTORY_ADDRESS_SEPOLIA = "0x750C5a6CFD40C9CaA48C31D87AC2a26101Acd517" as Address;
const FACTORY_DEPLOYMENT_BLOCK_MAINNET = 21167599n;
const FACTORY_DEPLOYMENT_BLOCK_SEPOLIA = 7057962n;

export interface TokenMetadataAPI {
  image?: string;
  animation_url?: string;
  name?: string;
  description?: string;
}

export interface TokenDataAPI {
  contractAddress: string;
  deployerAddress: string;
  tokenId: number;
  mintedBlock: number;
  name: string;
  description: string;
  closeAt: number;
  mintOpenUntil: number;
  totalMinted: number;
  uri?: string;
  metadata?: TokenMetadataAPI;
}

// RPC stats for logging
const rpcStats = {
  reset() {
    this.calls = { getLogs: 0, multicall: 0 };
    this.startTime = Date.now();
  },
  calls: { getLogs: 0, multicall: 0 },
  startTime: Date.now(),
  log() {
    const duration = Date.now() - this.startTime;
    const total = this.calls.getLogs + this.calls.multicall;
    console.log(`[Tokens RPC Stats] Total: ${total} RPC calls in ${duration}ms`);
    console.log(`  - getLogs: ${this.calls.getLogs}`);
    console.log(`  - multicall: ${this.calls.multicall}`);
  },
};

function createClient() {
  const isTestnet = process.env.IS_TESTNET === "true";
  const alchemyKey = process.env.ALCHEMY_API_KEY;

  if (!alchemyKey) {
    throw new Error("ALCHEMY_API_KEY environment variable is required");
  }

  const chain = isTestnet ? sepolia : mainnet;
  const rpcUrl = isTestnet
    ? `https://eth-sepolia.g.alchemy.com/v2/${alchemyKey}`
    : `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`;

  return createPublicClient({
    chain,
    transport: http(rpcUrl),
  });
}

export interface CachedTokensData {
  tokens: TokenDataAPI[];
  lastBlock: number;
  contractTokenCounts: Record<string, number>; // contract address -> last known tokenId
}

// Incremental fetch - only get new tokens since last fetch
export async function fetchTokensIncremental(
  existingData?: CachedTokensData
): Promise<CachedTokensData> {
  rpcStats.reset();
  const client = createClient();
  const isTestnet = process.env.IS_TESTNET === "true";

  const factoryAddress = isTestnet ? FACTORY_ADDRESS_SEPOLIA : FACTORY_ADDRESS_MAINNET;
  const deploymentBlock = isTestnet ? FACTORY_DEPLOYMENT_BLOCK_SEPOLIA : FACTORY_DEPLOYMENT_BLOCK_MAINNET;

  // Get current block
  const currentBlock = await client.getBlockNumber();

  // Start from last processed block or deployment block
  const fromBlock = existingData?.lastBlock
    ? BigInt(existingData.lastBlock + 1)
    : deploymentBlock;

  console.log(`[Tokens] Incremental fetch from block ${fromBlock} to ${currentBlock}`);

  // If we have existing data and it's recent (within 100 blocks), do incremental
  // Otherwise do full fetch
  const blockDiff = Number(currentBlock) - (existingData?.lastBlock || 0);
  const shouldDoFullFetch = !existingData || blockDiff > 50000; // ~1 week of blocks

  if (shouldDoFullFetch) {
    console.log("[Tokens] Doing full fetch (no existing data or too stale)");
    const tokens = await fetchAllTokensFull();

    // Build contract token counts
    const contractTokenCounts: Record<string, number> = {};
    for (const token of tokens) {
      const addr = token.contractAddress.toLowerCase();
      contractTokenCounts[addr] = Math.max(contractTokenCounts[addr] || 0, token.tokenId);
    }

    return {
      tokens,
      lastBlock: Number(currentBlock),
      contractTokenCounts,
    };
  }

  // Incremental fetch
  console.log("[Tokens] Doing incremental fetch");

  // Step 1: Get NEW contract creation events since last block
  const newCreatedLogs = await client.getLogs({
    address: factoryAddress,
    event: parseAbiItem("event Created(address indexed ownerAddress, address contractAddress)"),
    fromBlock,
    toBlock: "latest",
  });
  rpcStats.calls.getLogs++;

  const newContracts = newCreatedLogs
    .map((log) => ({
      owner: log.args.ownerAddress as Address,
      contractAddress: log.args.contractAddress as Address,
    }))
    .filter((c) => c.contractAddress);

  console.log(`[Tokens] Found ${newContracts.length} new contracts since block ${fromBlock}`);

  // Step 2: Get ALL contracts to check for new tokens on existing contracts
  const allCreatedLogs = await client.getLogs({
    address: factoryAddress,
    event: parseAbiItem("event Created(address indexed ownerAddress, address contractAddress)"),
    fromBlock: deploymentBlock,
    toBlock: "latest",
  });
  rpcStats.calls.getLogs++;

  const allContracts = allCreatedLogs
    .map((log) => ({
      owner: log.args.ownerAddress as Address,
      contractAddress: log.args.contractAddress as Address,
    }))
    .filter((c) => c.contractAddress);

  // Step 3: Check latestTokenId for all contracts
  const latestTokenIdCalls = allContracts.map((c) => ({
    address: c.contractAddress,
    abi: tokenAbi,
    functionName: "latestTokenId" as const,
  }));

  const latestTokenIdResults = await client.multicall({
    contracts: latestTokenIdCalls,
    allowFailure: true,
  });
  rpcStats.calls.multicall++;

  // Step 4: Find tokens we need to fetch (new contracts + new tokens on existing contracts)
  type TokenMeta = { contractAddress: Address; deployerAddress: Address; tokenId: number };
  const tokensToFetch: TokenMeta[] = [];
  const newContractTokenCounts: Record<string, number> = { ...existingData.contractTokenCounts };

  for (let i = 0; i < allContracts.length; i++) {
    const result = latestTokenIdResults[i];
    if (result.status !== "success") continue;

    const contract = allContracts[i];
    const addr = contract.contractAddress.toLowerCase();
    const latestTokenId = Number(result.result);
    const previousLatestId = existingData.contractTokenCounts[addr] || 0;

    newContractTokenCounts[addr] = latestTokenId;

    // Fetch tokens we don't have yet
    for (let tokenId = previousLatestId + 1; tokenId <= latestTokenId; tokenId++) {
      tokensToFetch.push({
        contractAddress: contract.contractAddress,
        deployerAddress: contract.owner,
        tokenId,
      });
    }
  }

  console.log(`[Tokens] Need to fetch ${tokensToFetch.length} new tokens`);

  if (tokensToFetch.length === 0) {
    // No new tokens, just update lastBlock
    return {
      tokens: existingData.tokens,
      lastBlock: Number(currentBlock),
      contractTokenCounts: newContractTokenCounts,
    };
  }

  // Step 5: Fetch the new tokens
  const newTokens = await fetchTokenData(client, tokensToFetch, deploymentBlock);

  // Step 6: Merge with existing tokens and sort
  const allTokens = [...existingData.tokens, ...newTokens];
  allTokens.sort((a, b) => b.mintedBlock - a.mintedBlock);

  console.log(`[Tokens] Total: ${allTokens.length} tokens (${newTokens.length} new)`);
  rpcStats.log();

  return {
    tokens: allTokens,
    lastBlock: Number(currentBlock),
    contractTokenCounts: newContractTokenCounts,
  };
}

// Helper to fetch token data for a list of tokens
type TokenMeta = { contractAddress: Address; deployerAddress: Address; tokenId: number };

async function fetchTokenData(
  client: ReturnType<typeof createClient>,
  tokenMeta: TokenMeta[],
  deploymentBlock: bigint
): Promise<TokenDataAPI[]> {
  if (tokenMeta.length === 0) return [];

  // Fetch token data using concurrent individual calls (avoids Multicall3 gas limits)
  const CONCURRENCY = 50;
  const allResults: { get: unknown; uri: unknown; mintOpenUntil: unknown }[] = [];

  for (let i = 0; i < tokenMeta.length; i += CONCURRENCY) {
    const batch = tokenMeta.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (meta) => {
        try {
          const [getResult, uriResult, mintOpenUntilResult] = await Promise.all([
            client.readContract({
              address: meta.contractAddress,
              abi: tokenAbi,
              functionName: "get",
              args: [BigInt(meta.tokenId)],
            }).catch(() => null),
            client.readContract({
              address: meta.contractAddress,
              abi: tokenAbi,
              functionName: "uri",
              args: [BigInt(meta.tokenId)],
            }).catch(() => null),
            client.readContract({
              address: meta.contractAddress,
              abi: tokenAbi,
              functionName: "mintOpenUntil",
              args: [BigInt(meta.tokenId)],
            }).catch(() => null),
          ]);
          return { get: getResult, uri: uriResult, mintOpenUntil: mintOpenUntilResult };
        } catch {
          return { get: null, uri: null, mintOpenUntil: null };
        }
      })
    );
    rpcStats.calls.multicall++;
    allResults.push(...batchResults);
  }

  // Get unique contracts for mint events
  const uniqueContracts = [...new Set(tokenMeta.map((m) => m.contractAddress))];
  const mintCountMap = new Map<string, number>();
  const LOGS_BATCH_SIZE = 10;

  for (let i = 0; i < uniqueContracts.length; i += LOGS_BATCH_SIZE) {
    const batch = uniqueContracts.slice(i, i + LOGS_BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (contractAddress) => {
        try {
          const mintLogs = await client.getLogs({
            address: contractAddress,
            event: parseAbiItem("event NewMint(uint256 indexed tokenId, uint256 unitPrice, uint256 amount, address minter)"),
            fromBlock: deploymentBlock,
            toBlock: "latest",
          });
          rpcStats.calls.getLogs++;
          return { contractAddress, logs: mintLogs };
        } catch (err) {
          console.error(`Error fetching mint events for ${contractAddress}:`, err);
          return { contractAddress, logs: [] };
        }
      })
    );

    for (const { contractAddress, logs } of batchResults) {
      for (const log of logs) {
        const tokenId = Number(log.args.tokenId);
        const amount = Number(log.args.amount || 0);
        const key = `${contractAddress.toLowerCase()}-${tokenId}`;
        mintCountMap.set(key, (mintCountMap.get(key) || 0) + amount);
      }
    }
  }

  // Parse results
  const tokens: TokenDataAPI[] = [];
  let skippedInFetch = 0;

  for (let i = 0; i < tokenMeta.length; i++) {
    const meta = tokenMeta[i];
    const result = allResults[i];

    if (!result.get) {
      skippedInFetch++;
      if (skippedInFetch <= 5) {
        console.log(`[Tokens] fetchTokenData: Skipped ${meta.contractAddress} token ${meta.tokenId} - get() returned null`);
      }
      continue;
    }

    const details = result.get as [string, string, Address[], number, number, bigint, bigint];
    const uri = result.uri as string | undefined;
    const mintOpenUntil = result.mintOpenUntil ? Number(result.mintOpenUntil) : 0;
    const mintKey = `${meta.contractAddress.toLowerCase()}-${meta.tokenId}`;
    const totalMinted = mintCountMap.get(mintKey) || 0;

    tokens.push({
      contractAddress: meta.contractAddress,
      deployerAddress: meta.deployerAddress,
      tokenId: meta.tokenId,
      mintedBlock: Number(details[4]),
      name: details[0],
      description: details[1],
      closeAt: Number(details[5]),
      mintOpenUntil,
      totalMinted,
      uri,
    });
  }

  if (skippedInFetch > 0) {
    console.log(`[Tokens] fetchTokenData: ${tokens.length} succeeded, ${skippedInFetch} failed get()`);
  }

  return tokens;
}

// Full fetch (original function, renamed)
async function fetchAllTokensFull(): Promise<TokenDataAPI[]> {
  const client = createClient();
  const isTestnet = process.env.IS_TESTNET === "true";

  const factoryAddress = isTestnet ? FACTORY_ADDRESS_SEPOLIA : FACTORY_ADDRESS_MAINNET;
  const deploymentBlock = isTestnet ? FACTORY_DEPLOYMENT_BLOCK_SEPOLIA : FACTORY_DEPLOYMENT_BLOCK_MAINNET;

  // Step 1: Get all contract creation events
  const createdLogs = await client.getLogs({
    address: factoryAddress,
    event: parseAbiItem("event Created(address indexed ownerAddress, address contractAddress)"),
    fromBlock: deploymentBlock,
    toBlock: "latest",
  });
  rpcStats.calls.getLogs++;

  const contracts = createdLogs
    .map((log) => ({
      owner: log.args.ownerAddress as Address,
      contractAddress: log.args.contractAddress as Address,
    }))
    .filter((c) => c.contractAddress);

  if (contracts.length === 0) {
    return [];
  }

  console.log(`[Tokens] Found ${contracts.length} contracts`);

  // Step 2: Get latestTokenId for each contract using multicall
  const latestTokenIdCalls = contracts.map((c) => ({
    address: c.contractAddress,
    abi: tokenAbi,
    functionName: "latestTokenId" as const,
  }));

  const latestTokenIdResults = await client.multicall({
    contracts: latestTokenIdCalls,
    allowFailure: true,
  });
  rpcStats.calls.multicall++;

  // Build list of all token calls needed
  type TokenMeta = { contractAddress: Address; deployerAddress: Address; tokenId: number };
  const tokenMeta: TokenMeta[] = [];

  for (let i = 0; i < contracts.length; i++) {
    const result = latestTokenIdResults[i];
    if (result.status !== "success") continue;

    const latestTokenId = Number(result.result);
    const contract = contracts[i];

    for (let tokenId = 1; tokenId <= latestTokenId; tokenId++) {
      tokenMeta.push({
        contractAddress: contract.contractAddress,
        deployerAddress: contract.owner,
        tokenId,
      });
    }
  }

  console.log(`[Tokens] Fetching ${tokenMeta.length} tokens across ${contracts.length} contracts`);

  // Step 3: Fetch token data using concurrent individual calls
  // Using Promise.all with individual readContract calls instead of multicall
  // This avoids Multicall3 gas limit issues while still being efficient
  const CONCURRENCY = 50; // Process 50 tokens at a time
  const allResults: { get: unknown; uri: unknown; mintOpenUntil: unknown }[] = [];

  for (let i = 0; i < tokenMeta.length; i += CONCURRENCY) {
    const batch = tokenMeta.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (meta) => {
        try {
          const [getResult, uriResult, mintOpenUntilResult] = await Promise.all([
            client.readContract({
              address: meta.contractAddress,
              abi: tokenAbi,
              functionName: "get",
              args: [BigInt(meta.tokenId)],
            }).catch(() => null),
            client.readContract({
              address: meta.contractAddress,
              abi: tokenAbi,
              functionName: "uri",
              args: [BigInt(meta.tokenId)],
            }).catch(() => null),
            client.readContract({
              address: meta.contractAddress,
              abi: tokenAbi,
              functionName: "mintOpenUntil",
              args: [BigInt(meta.tokenId)],
            }).catch(() => null),
          ]);
          return { get: getResult, uri: uriResult, mintOpenUntil: mintOpenUntilResult };
        } catch {
          return { get: null, uri: null, mintOpenUntil: null };
        }
      })
    );
    rpcStats.calls.multicall++; // Count as batch operation
    allResults.push(...batchResults);
  }

  console.log(`[Tokens] Fetched data for ${allResults.length} tokens`);

  // Step 5: Get NewMint events for all contracts to calculate totalMinted
  // Parallelize with concurrency limit
  const mintCountMap = new Map<string, number>(); // key: "contractAddress-tokenId"
  const LOGS_BATCH_SIZE = 10; // Fetch 10 contracts' logs in parallel

  for (let i = 0; i < contracts.length; i += LOGS_BATCH_SIZE) {
    const batch = contracts.slice(i, i + LOGS_BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (contract) => {
        try {
          const mintLogs = await client.getLogs({
            address: contract.contractAddress,
            event: parseAbiItem("event NewMint(uint256 indexed tokenId, uint256 unitPrice, uint256 amount, address minter)"),
            fromBlock: deploymentBlock,
            toBlock: "latest",
          });
          rpcStats.calls.getLogs++;
          return { contractAddress: contract.contractAddress, logs: mintLogs };
        } catch (err) {
          console.error(`Error fetching mint events for ${contract.contractAddress}:`, err);
          return { contractAddress: contract.contractAddress, logs: [] };
        }
      })
    );

    for (const { contractAddress, logs } of batchResults) {
      for (const log of logs) {
        const tokenId = Number(log.args.tokenId);
        const amount = Number(log.args.amount || 0);
        const key = `${contractAddress.toLowerCase()}-${tokenId}`;
        mintCountMap.set(key, (mintCountMap.get(key) || 0) + amount);
      }
    }
  }

  // Step 6: Parse results
  const tokens: TokenDataAPI[] = [];
  let skippedCount = 0;

  for (let i = 0; i < tokenMeta.length; i++) {
    const meta = tokenMeta[i];
    const result = allResults[i];

    if (!result.get) {
      skippedCount++;
      if (skippedCount <= 10) {
        console.log(`[Tokens] Skipped ${meta.contractAddress} token ${meta.tokenId}: get() returned null`);
      }
      continue;
    }

    const details = result.get as [string, string, Address[], number, number, bigint, bigint];
    const uri = result.uri as string | undefined;
    const mintOpenUntil = result.mintOpenUntil ? Number(result.mintOpenUntil) : 0;
    const mintKey = `${meta.contractAddress.toLowerCase()}-${meta.tokenId}`;
    const totalMinted = mintCountMap.get(mintKey) || 0;

    tokens.push({
      contractAddress: meta.contractAddress,
      deployerAddress: meta.deployerAddress,
      tokenId: meta.tokenId,
      mintedBlock: Number(details[4]),
      name: details[0],
      description: details[1],
      closeAt: Number(details[5]),
      mintOpenUntil,
      totalMinted,
      uri,
    });

  }

  // Sort by minted block descending (newest first)
  tokens.sort((a, b) => b.mintedBlock - a.mintedBlock);

  // Note: Metadata (images) fetched client-side to avoid slow IPFS/external requests

  rpcStats.log();
  console.log(`[Tokens] Returning ${tokens.length} tokens (skipped ${skippedCount} failed get() calls)`);

  return tokens;
}

// Backwards compatible export
export async function fetchAllTokens(): Promise<TokenDataAPI[]> {
  return fetchAllTokensFull();
}
