import { BountyData } from "@/types/bounty";
import { Address } from "viem";

interface BountyDataAPI {
  bountyContract: string;
  bountyId: number;
  tokenContract: string;
  lastMintedId: number;
  gasRefundAmount: string;
  claimedCount: number;
  maxClaims: number;
  isActive: boolean;
  balance: string;
  createdAt: number;
  gasRefundRecipient: string;
  owner: string;
  tokenName?: string;
  tokenOwner?: string;
  contractUri?: string;
  latestTokenId?: number;
  isClaimable?: boolean;
  ownerEnsName?: string | null;
  tokenOwnerEnsName?: string | null;
}

function parseAPIResponse(data: BountyDataAPI[]): BountyData[] {
  return data.map((item) => ({
    bountyContract: item.bountyContract as Address,
    bountyId: item.bountyId,
    tokenContract: item.tokenContract as Address,
    lastMintedId: item.lastMintedId,
    gasRefundAmount: BigInt(item.gasRefundAmount),
    claimedCount: item.claimedCount,
    maxClaims: item.maxClaims,
    isActive: item.isActive,
    balance: BigInt(item.balance),
    createdAt: item.createdAt,
    gasRefundRecipient: item.gasRefundRecipient as Address,
    owner: item.owner as Address,
    tokenName: item.tokenName,
    tokenOwner: item.tokenOwner as Address | undefined,
    contractUri: item.contractUri,
    latestTokenId: item.latestTokenId,
    isClaimable: item.isClaimable,
    ownerEnsName: item.ownerEnsName,
    tokenOwnerEnsName: item.tokenOwnerEnsName,
  }));
}

export async function fetchBountiesFromAPI(): Promise<BountyData[]> {
  const response = await fetch("/api/bounties");

  if (!response.ok) {
    throw new Error(`Failed to fetch bounties: ${response.status}`);
  }

  const data: BountyDataAPI[] = await response.json();
  return parseAPIResponse(data);
}

// Token types and API
export interface TokenMetadata {
  image?: string;
  animation_url?: string;
  name?: string;
  description?: string;
}

export interface TokenInfo {
  contractAddress: Address;
  deployerAddress: Address;
  tokenId: number;
  mintedBlock: number;
  name: string;
  description: string;
  closeAt: number;
  mintOpenUntil: number;
  totalMinted: number;
  uri?: string;
  metadata?: TokenMetadata;
}

interface TokenDataAPI {
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
  metadata?: TokenMetadata;
}

export interface TokensResponse {
  tokens: TokenInfo[];
  cacheStatus: string;
  cacheAgeSeconds: number;
  isStale: boolean;
  isWarmingUp: boolean;
}

export async function fetchTokensFromAPI(): Promise<TokensResponse> {
  const response = await fetch("/api/tokens");

  if (!response.ok) {
    throw new Error(`Failed to fetch tokens: ${response.status}`);
  }

  const cacheStatus = response.headers.get("X-Cache-Status") || "UNKNOWN";
  const cacheAgeSeconds = parseInt(response.headers.get("X-Cache-Age") || "0", 10);
  const isStale = cacheStatus === "STALE_REFRESH" || cacheAgeSeconds > 300;
  const isWarmingUp = cacheStatus === "WARMING_UP";

  const data: TokenDataAPI[] = await response.json();
  const tokens = data.map((item) => ({
    contractAddress: item.contractAddress as Address,
    deployerAddress: item.deployerAddress as Address,
    tokenId: item.tokenId,
    mintedBlock: item.mintedBlock,
    name: item.name,
    description: item.description,
    closeAt: item.closeAt,
    mintOpenUntil: item.mintOpenUntil,
    totalMinted: item.totalMinted,
    uri: item.uri,
    metadata: item.metadata,
  }));

  return { tokens, cacheStatus, cacheAgeSeconds, isStale, isWarmingUp };
}

// Token detail types and API
export interface MintEvent {
  minter: Address;
  minterEnsName?: string | null;
  amount: number;
  blockNumber: number;
  timestamp: number;
  txHash: string;
}

export interface TokenDetail {
  contractAddress: Address;
  deployerAddress: Address;
  deployerEnsName?: string | null;
  tokenId: number;
  mintedBlock: number;
  name: string;
  description: string;
  closeAt: number;
  mintOpenUntil: number;
  totalMinted: number;
  uri?: string;
  mintHistory: MintEvent[];
}

interface TokenDetailAPI {
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
  mintHistory: {
    minter: string;
    minterEnsName?: string | null;
    amount: number;
    blockNumber: number;
    timestamp: number;
    txHash: string;
  }[];
}

export async function fetchTokenDetailFromAPI(
  contractAddress: string,
  tokenId: number
): Promise<TokenDetail> {
  const response = await fetch(`/api/token/${contractAddress}/${tokenId}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch token: ${response.status}`);
  }

  const data: TokenDetailAPI = await response.json();
  return {
    contractAddress: data.contractAddress as Address,
    deployerAddress: data.deployerAddress as Address,
    deployerEnsName: data.deployerEnsName,
    tokenId: data.tokenId,
    mintedBlock: data.mintedBlock,
    name: data.name,
    description: data.description,
    closeAt: data.closeAt,
    mintOpenUntil: data.mintOpenUntil,
    totalMinted: data.totalMinted,
    uri: data.uri,
    mintHistory: data.mintHistory.map((event) => ({
      minter: event.minter as Address,
      minterEnsName: event.minterEnsName,
      amount: event.amount,
      blockNumber: event.blockNumber,
      timestamp: event.timestamp,
      txHash: event.txHash,
    })),
  };
}
