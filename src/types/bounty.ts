import { Address } from "viem";

export interface BountyData {
  bountyContract: Address;
  bountyId: number;
  tokenContract: Address;
  lastMintedId: number;
  gasRefundAmount: bigint;
  claimedCount: number;
  maxClaims: number;
  isActive: boolean;
  balance: bigint;
  createdAt: number;
  gasRefundRecipient: Address;
  owner: Address;
  // Extended fields from API (token metadata)
  tokenName?: string;
  tokenOwner?: Address;
  contractUri?: string;
  latestTokenId?: number;
  isClaimable?: boolean;
}