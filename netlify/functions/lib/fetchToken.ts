import { createPublicClient, http, Address, parseAbiItem } from "viem";
import { mainnet, sepolia } from "viem/chains";

const tokenAbi = [
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

export interface MintEventAPI {
  minter: string;
  minterEnsName?: string | null;
  amount: number;
  blockNumber: number;
  timestamp: number;
  txHash: string;
}

export interface TokenDetailAPI {
  contractAddress: string;
  deployerAddress: string;
  deployerEnsName?: string | null;
  tokenId: number;
  mintedBlock: number;
  name: string;
  description: string;
  closeAt: number;
  mintOpenUntil: number;
  totalMinted: number;
  uri?: string;
  mintHistory: MintEventAPI[];
}

// RPC stats for logging
const rpcStats = {
  reset() {
    this.calls = { getLogs: 0, multicall: 0, getBlock: 0, getEnsName: 0 };
    this.startTime = Date.now();
  },
  calls: { getLogs: 0, multicall: 0, getBlock: 0, getEnsName: 0 },
  startTime: Date.now(),
  log() {
    const duration = Date.now() - this.startTime;
    const total = this.calls.getLogs + this.calls.multicall + this.calls.getBlock + this.calls.getEnsName;
    console.log(`[Token RPC Stats] Total: ${total} RPC calls in ${duration}ms`);
    console.log(`  - getLogs: ${this.calls.getLogs}`);
    console.log(`  - multicall: ${this.calls.multicall}`);
    console.log(`  - getBlock: ${this.calls.getBlock}`);
    console.log(`  - getEnsName: ${this.calls.getEnsName}`);
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

export async function fetchTokenDetail(
  contractAddress: Address,
  tokenId: number
): Promise<TokenDetailAPI | null> {
  rpcStats.reset();
  const client = createClient();
  const isTestnet = process.env.IS_TESTNET === "true";

  const factoryAddress = isTestnet ? FACTORY_ADDRESS_SEPOLIA : FACTORY_ADDRESS_MAINNET;
  const deploymentBlock = isTestnet ? FACTORY_DEPLOYMENT_BLOCK_SEPOLIA : FACTORY_DEPLOYMENT_BLOCK_MAINNET;

  // Step 1: Get deployer from factory events
  const createdLogs = await client.getLogs({
    address: factoryAddress,
    event: parseAbiItem("event Created(address indexed ownerAddress, address contractAddress)"),
    fromBlock: deploymentBlock,
    toBlock: "latest",
  });
  rpcStats.calls.getLogs++;

  const deployerEvent = createdLogs.find(
    (log) => log.args.contractAddress?.toLowerCase() === contractAddress.toLowerCase()
  );

  if (!deployerEvent) {
    console.log(`[Token] Contract ${contractAddress} not found in factory events`);
    return null;
  }

  const deployerAddress = deployerEvent.args.ownerAddress as Address;

  // Step 2: Get token data using multicall
  const tokenCalls = [
    { address: contractAddress, abi: tokenAbi, functionName: "get" as const, args: [BigInt(tokenId)] as const },
    { address: contractAddress, abi: tokenAbi, functionName: "uri" as const, args: [BigInt(tokenId)] as const },
    { address: contractAddress, abi: tokenAbi, functionName: "mintOpenUntil" as const, args: [BigInt(tokenId)] as const },
  ];

  const results = await client.multicall({
    contracts: tokenCalls,
    allowFailure: true,
  });
  rpcStats.calls.multicall++;

  const getResult = results[0];
  const uriResult = results[1];
  const mintOpenUntilResult = results[2];

  if (getResult.status !== "success") {
    console.log(`[Token] Failed to get token ${tokenId} from ${contractAddress}`);
    return null;
  }

  const details = getResult.result as [string, string, Address[], number, number, bigint, bigint];
  const uri = uriResult.status === "success" ? (uriResult.result as string) : undefined;
  const mintOpenUntil = mintOpenUntilResult.status === "success" ? Number(mintOpenUntilResult.result) : 0;

  // Step 3: Get mint events for this token
  const mintLogs = await client.getLogs({
    address: contractAddress,
    event: parseAbiItem("event NewMint(uint256 indexed tokenId, uint256 unitPrice, uint256 amount, address minter)"),
    args: {
      tokenId: BigInt(tokenId),
    },
    fromBlock: deploymentBlock,
    toBlock: "latest",
  });
  rpcStats.calls.getLogs++;

  // Step 4: Get unique block numbers and fetch timestamps in batches
  const uniqueBlocks = [...new Set(mintLogs.map((log) => log.blockNumber))];
  const blockTimestamps = new Map<bigint, number>();

  // Batch fetch blocks (10 at a time)
  const BLOCK_BATCH_SIZE = 10;
  for (let i = 0; i < uniqueBlocks.length; i += BLOCK_BATCH_SIZE) {
    const batch = uniqueBlocks.slice(i, i + BLOCK_BATCH_SIZE);
    const blockResults = await Promise.all(
      batch.map(async (blockNumber) => {
        const block = await client.getBlock({ blockNumber });
        rpcStats.calls.getBlock++;
        return { blockNumber, timestamp: Number(block.timestamp) };
      })
    );
    for (const { blockNumber, timestamp } of blockResults) {
      blockTimestamps.set(blockNumber, timestamp);
    }
  }

  // Step 5: Build mint history with timestamps
  const mintHistory: MintEventAPI[] = mintLogs.map((log) => ({
    minter: log.args.minter as string,
    amount: Number(log.args.amount || 0),
    blockNumber: Number(log.blockNumber),
    timestamp: blockTimestamps.get(log.blockNumber) || 0,
    txHash: log.transactionHash,
  }));

  // Sort by timestamp descending (newest first)
  mintHistory.sort((a, b) => b.timestamp - a.timestamp);

  const totalMinted = mintHistory.reduce((acc, event) => acc + event.amount, 0);

  // Step 6: Resolve ENS names for deployer and all unique minters
  const uniqueMinters = [...new Set(mintHistory.map((e) => e.minter.toLowerCase()))];
  const allAddresses = [deployerAddress.toLowerCase(), ...uniqueMinters];
  const ensNames = new Map<string, string | null>();

  // Batch ENS lookups (10 at a time)
  const ENS_BATCH_SIZE = 10;
  for (let i = 0; i < allAddresses.length; i += ENS_BATCH_SIZE) {
    const batch = allAddresses.slice(i, i + ENS_BATCH_SIZE);
    const ensResults = await Promise.all(
      batch.map(async (addr) => {
        try {
          const name = await client.getEnsName({ address: addr as Address });
          rpcStats.calls.getEnsName++;
          return { address: addr, name };
        } catch {
          rpcStats.calls.getEnsName++;
          return { address: addr, name: null };
        }
      })
    );
    for (const { address, name } of ensResults) {
      ensNames.set(address, name);
    }
  }

  // Add ENS names to mint history
  for (const event of mintHistory) {
    event.minterEnsName = ensNames.get(event.minter.toLowerCase()) || null;
  }

  const deployerEnsName = ensNames.get(deployerAddress.toLowerCase()) || null;

  rpcStats.log();

  return {
    contractAddress,
    deployerAddress,
    deployerEnsName,
    tokenId,
    mintedBlock: Number(details[4]),
    name: details[0],
    description: details[1],
    closeAt: Number(details[5]),
    mintOpenUntil,
    totalMinted,
    uri,
    mintHistory,
  };
}
