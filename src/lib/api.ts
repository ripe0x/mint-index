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
