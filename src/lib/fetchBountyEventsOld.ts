import { client } from "@/config";
import { Address } from "viem";
import { BountyData } from "@/types/bounty";

import { abiMintBountyNew } from "@/abi/abiMintBountyNew";

const DEFAULT_TOKEN_CONTRACT = "0xBA1901b542Aa58f181F7ae18eD6Cd79FdA779C62" as Address;

export async function fetchOldBountiesForContract(
  bountyContract: Address,
  owner: Address
): Promise<BountyData[]> {
  const bounties: BountyData[] = [];

  try {
    console.log(`Checking old bounty contract ${bountyContract} for DEFAULT_TOKEN_CONTRACT ${DEFAULT_TOKEN_CONTRACT}`);
    // Try to read the default token contract bounty
    const bountyData = await client.readContract({
      address: bountyContract,
      abi: abiMintBountyNew,
      functionName: "bounties",
      args: [DEFAULT_TOKEN_CONTRACT],
    });

    console.log(`Bounty data for ${bountyContract}:`, bountyData);

    // Always add bounty if it exists (even with 0 balance to see inactive bounties)
    if (bountyData) {
      bounties.push({
        bountyContract,
        bountyId: 0,
        tokenContract: DEFAULT_TOKEN_CONTRACT,
        lastMintedId: Number(bountyData[2]),
        gasRefundAmount: bountyData[4], // minterReward
        claimedCount: 0, // We don't have a direct way to get claimed count from this contract
        maxClaims: Number(bountyData[3]), // artifactsToMint
        isActive: !bountyData[1], // !paused
        balance: bountyData[6],
        createdAt: 0, // not available in old contracts
        gasRefundRecipient: bountyData[0],
        owner,
      });
    }
  } catch {
    console.log(`Contract ${bountyContract} might be using new ABI or has no bounties`);
  }

  return bounties;
}