import { createPublicClient, http, Address, parseAbiItem } from "viem";
import { mainnet, sepolia } from "viem/chains";

// Server-side RPC call counter
const rpcStats = {
  reset() {
    this.calls = { getLogs: 0, multicall: 0, getEnsName: 0, other: 0 };
    this.startTime = Date.now();
  },
  calls: { getLogs: 0, multicall: 0, getEnsName: 0, other: 0 },
  startTime: Date.now(),
  log() {
    const duration = Date.now() - this.startTime;
    const total = Object.values(this.calls).reduce((a, b) => a + b, 0);
    console.log(`[Server RPC Stats] Total: ${total} calls in ${duration}ms`);
    console.log(`  - getLogs: ${this.calls.getLogs}`);
    console.log(`  - multicall: ${this.calls.multicall} (batched contract reads)`);
    console.log(`  - getEnsName: ${this.calls.getEnsName}`);
    console.log(`  - other: ${this.calls.other}`);
  },
};

export { rpcStats };

// ABIs for contract calls (minimal versions for what we need)
const bountyAbi = [
  {
    type: "function",
    name: "bounties",
    inputs: [{ name: "", type: "address" }],
    outputs: [
      { name: "recipient", type: "address" },
      { name: "paused", type: "bool" },
      { name: "lastMintedId", type: "uint96" },
      { name: "artifactsToMint", type: "uint256" },
      { name: "minterReward", type: "uint256" },
      { name: "maxArtifactPrice", type: "uint256" },
      { name: "balance", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isBountyClaimable",
    inputs: [{ name: "tokenContract", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
] as const;

const tokenAbi = [
  {
    type: "function",
    name: "contractURI",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "latestTokenId",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

const BOUNTY_FACTORY_ADDRESS = "0x1Bf79888027B7EeE2e5B30890DbfD9157EB4C06a" as Address;
const TOKEN_FACTORY_ADDRESS = "0xd717Fe677072807057B03705227EC3E3b467b670" as Address;
const START_BLOCK = 21385383n;

export interface BountyDataAPI {
  bountyContract: string;
  bountyId: number;
  tokenContract: string;
  lastMintedId: number;
  gasRefundAmount: string; // bigint as string for JSON
  claimedCount: number;
  maxClaims: number;
  isActive: boolean;
  balance: string; // bigint as string for JSON
  createdAt: number;
  gasRefundRecipient: string;
  owner: string;
  // Extended fields from token contract
  tokenName?: string;
  tokenOwner?: string;
  contractUri?: string;
  latestTokenId?: number;
  isClaimable?: boolean;
  // Cached ENS names
  ownerEnsName?: string | null;
  tokenOwnerEnsName?: string | null;
}

interface BountyContractDeployed {
  owner: Address;
  bountyContract: Address;
}

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

async function fetchBountyFactoryEvents(client: ReturnType<typeof createClient>): Promise<BountyContractDeployed[]> {
  const logs = await client.getLogs({
    address: BOUNTY_FACTORY_ADDRESS,
    event: parseAbiItem("event BountyContractDeployed(address indexed owner, address indexed bountyContract)"),
    fromBlock: START_BLOCK,
    toBlock: "latest",
  });

  const seenContracts = new Set<string>();
  const results: BountyContractDeployed[] = [];

  for (const log of logs) {
    const topics = log.topics as readonly string[];
    const contractAddr = topics.length > 2 ? (`0x${topics[2].slice(-40)}` as Address) : undefined;
    const ownerAddr = topics.length > 1 ? (`0x${topics[1].slice(-40)}` as Address) : undefined;

    if (contractAddr && ownerAddr && !seenContracts.has(contractAddr.toLowerCase())) {
      seenContracts.add(contractAddr.toLowerCase());
      results.push({ owner: ownerAddr, bountyContract: contractAddr });
    }
  }

  return results;
}

async function fetchAllTokenContracts(client: ReturnType<typeof createClient>): Promise<Address[]> {
  const logs = await client.getLogs({
    address: TOKEN_FACTORY_ADDRESS,
    event: parseAbiItem("event Created(address indexed ownerAddress, address contractAddress)"),
    fromBlock: START_BLOCK,
    toBlock: "latest",
  });

  return logs
    .map((log) => log.args?.contractAddress as Address | undefined)
    .filter((addr): addr is Address => !!addr);
}

async function fetchTokenMetadata(uri: string): Promise<{ name?: string; image?: string }> {
  try {
    const response = await fetch(uri, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return {};
    return await response.json();
  } catch {
    return {};
  }
}

export async function fetchAllBounties(): Promise<BountyDataAPI[]> {
  rpcStats.reset();
  const client = createClient();

  // Step 1: Get all deployed bounty contracts and token contracts
  const [deployedContracts, allTokenContracts] = await Promise.all([
    fetchBountyFactoryEvents(client),
    fetchAllTokenContracts(client),
  ]);
  rpcStats.calls.getLogs += 2; // Two getLogs calls above

  if (deployedContracts.length === 0) {
    return [];
  }

  // Add known contracts as fallback
  const tokenContracts = new Set<Address>(allTokenContracts);
  tokenContracts.add("0xBA1901b542Aa58f181F7ae18eD6Cd79FdA779C62" as Address);
  tokenContracts.add("0xb437c5228d75A0769E2318Cf5E0Aa893058966CA" as Address);

  const tokenContractsArray = Array.from(tokenContracts);

  // Step 2: Use multicall to batch all bounty reads
  // Create contracts array for multicall: bountyContract × tokenContract combinations
  const bountyReadContracts = deployedContracts.flatMap((deployment) =>
    tokenContractsArray.map((tokenContract) => ({
      address: deployment.bountyContract,
      abi: bountyAbi,
      functionName: "bounties" as const,
      args: [tokenContract] as const,
    }))
  );

  // Also get claimable status for each combination
  const claimableContracts = deployedContracts.flatMap((deployment) =>
    tokenContractsArray.map((tokenContract) => ({
      address: deployment.bountyContract,
      abi: bountyAbi,
      functionName: "isBountyClaimable" as const,
      args: [tokenContract] as const,
    }))
  );

  // Get token contract metadata (contractURI, owner, latestTokenId) for each unique token
  const tokenMetadataContracts = tokenContractsArray.flatMap((tokenContract) => [
    { address: tokenContract, abi: tokenAbi, functionName: "contractURI" as const },
    { address: tokenContract, abi: tokenAbi, functionName: "owner" as const },
    { address: tokenContract, abi: tokenAbi, functionName: "latestTokenId" as const },
  ]);

  // Execute all multicalls in parallel
  const [bountyResults, claimableResults, tokenMetadataResults] = await Promise.all([
    client.multicall({ contracts: bountyReadContracts, allowFailure: true }),
    client.multicall({ contracts: claimableContracts, allowFailure: true }),
    client.multicall({ contracts: tokenMetadataContracts, allowFailure: true }),
  ]);
  rpcStats.calls.multicall += 3; // Three multicall batches

  // Parse token metadata into a map
  const tokenMetadataMap = new Map<
    string,
    { contractUri?: string; tokenOwner?: string; latestTokenId?: number; tokenName?: string }
  >();

  for (let i = 0; i < tokenContractsArray.length; i++) {
    const tokenContract = tokenContractsArray[i].toLowerCase();
    const contractUriResult = tokenMetadataResults[i * 3];
    const ownerResult = tokenMetadataResults[i * 3 + 1];
    const latestTokenIdResult = tokenMetadataResults[i * 3 + 2];

    const metadata: { contractUri?: string; tokenOwner?: string; latestTokenId?: number; tokenName?: string } = {};

    if (contractUriResult.status === "success") {
      metadata.contractUri = contractUriResult.result as string;
      // Fetch token name from metadata URI
      const tokenMeta = await fetchTokenMetadata(metadata.contractUri);
      metadata.tokenName = tokenMeta.name;
    }
    if (ownerResult.status === "success") {
      metadata.tokenOwner = ownerResult.result as string;
    }
    if (latestTokenIdResult.status === "success") {
      metadata.latestTokenId = Number(latestTokenIdResult.result);
    }

    tokenMetadataMap.set(tokenContract, metadata);
  }

  // Step 3: Parse results and build bounty data
  const bounties: BountyDataAPI[] = [];
  let resultIndex = 0;

  for (const deployment of deployedContracts) {
    for (const tokenContract of tokenContractsArray) {
      const bountyResult = bountyResults[resultIndex];
      const claimableResult = claimableResults[resultIndex];
      resultIndex++;

      if (bountyResult.status !== "success") continue;

      const bountyData = bountyResult.result as readonly [Address, boolean, bigint, bigint, bigint, bigint, bigint];
      const recipient = bountyData[0];

      // Skip if no bounty exists (recipient is zero address)
      if (recipient === "0x0000000000000000000000000000000000000000") continue;

      const isActive = !bountyData[1]; // !paused
      const balance = bountyData[6];

      const tokenMeta = tokenMetadataMap.get(tokenContract.toLowerCase()) || {};

      bounties.push({
        bountyContract: deployment.bountyContract,
        bountyId: 0,
        tokenContract: tokenContract,
        lastMintedId: Number(bountyData[2]),
        gasRefundAmount: bountyData[4].toString(),
        claimedCount: 0,
        maxClaims: Number(bountyData[3]),
        isActive,
        balance: balance.toString(),
        createdAt: 0,
        gasRefundRecipient: recipient,
        owner: deployment.owner,
        tokenName: tokenMeta.tokenName,
        tokenOwner: tokenMeta.tokenOwner,
        contractUri: tokenMeta.contractUri,
        latestTokenId: tokenMeta.latestTokenId,
        isClaimable: claimableResult.status === "success" ? (claimableResult.result as boolean) : false,
      });
    }
  }

  // Step 4: Resolve ENS names for all unique addresses
  const uniqueAddresses = new Set<string>();
  for (const bounty of bounties) {
    uniqueAddresses.add(bounty.owner.toLowerCase());
    if (bounty.tokenOwner) {
      uniqueAddresses.add(bounty.tokenOwner.toLowerCase());
    }
  }

  const addressArray = Array.from(uniqueAddresses);
  const ensMap = new Map<string, string | null>();

  // Resolve ENS names in parallel (with error handling for each)
  const ensResults = await Promise.all(
    addressArray.map(async (addr) => {
      try {
        const name = await client.getEnsName({ address: addr as Address });
        rpcStats.calls.getEnsName++;
        return { addr, name };
      } catch {
        rpcStats.calls.getEnsName++;
        return { addr, name: null };
      }
    })
  );

  for (const { addr, name } of ensResults) {
    ensMap.set(addr, name);
  }

  // Add ENS names to bounties
  for (const bounty of bounties) {
    bounty.ownerEnsName = ensMap.get(bounty.owner.toLowerCase()) || null;
    if (bounty.tokenOwner) {
      bounty.tokenOwnerEnsName = ensMap.get(bounty.tokenOwner.toLowerCase()) || null;
    }
  }

  // Log RPC stats
  rpcStats.log();
  console.log(`[Server] Returning ${bounties.length} bounties, ${addressArray.length} unique addresses resolved`);

  return bounties;
}
