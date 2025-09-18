import { client } from "@/config";
import { Address, parseAbiItem } from "viem";
import { abiMintBountyNew } from "@/abi/abiMintBountyNew";
import { BountyData } from "@/types/bounty";

const FACTORY_ADDRESS = "0x1Bf79888027B7EeE2e5B30890DbfD9157EB4C06a";
const DEFAULT_TOKEN_CONTRACT = "0xBA1901b542Aa58f181F7ae18eD6Cd79FdA779C62" as Address;

export interface BountyContractDeployed {
  owner: Address;
  bountyContract: Address;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
}

export async function fetchBountyFactoryEvents(
  ownerFilter?: Address
): Promise<BountyContractDeployed[]> {
  try {
    console.log("Fetching bounty events from factory:", FACTORY_ADDRESS);

    const logs = await client.getLogs({
      address: FACTORY_ADDRESS as Address,
      event: parseAbiItem('event BountyContractDeployed(address indexed owner, address indexed bountyContract)'),
      fromBlock: 21400000n,
      toBlock: "latest",
      args: ownerFilter ? { owner: ownerFilter } : undefined,
    });

    console.log(`Found ${logs.length} deployed bounty contracts`);

    return logs.map((log) => {
      // bountyContract is indexed, so it's in topics[2]
      const bountyContract = log.topics[2]
        ? `0x${log.topics[2].slice(-40)}` as Address
        : log.args.bountyContract as Address;

      return {
        owner: log.args.owner as Address,
        bountyContract,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
      };
    });
  } catch (error) {
    console.error("Error fetching bounty factory events:", error);
    return [];
  }
}

export async function fetchAllBounties(): Promise<BountyData[]> {
  try {
    // First get all deployed bounty contracts
    const deployedContracts = await fetchBountyFactoryEvents();
    console.log(`Found ${deployedContracts.length} deployed bounty contracts`);

    if (deployedContracts.length === 0) {
      return [];
    }

    // For each contract, fetch the bounty for DEFAULT_TOKEN_CONTRACT
    const allBountiesPromises = deployedContracts.map(async (deployment) => {
      try {
        // Read bounty data for DEFAULT_TOKEN_CONTRACT
        const bountyData = await client.readContract({
          address: deployment.bountyContract,
          abi: abiMintBountyNew,
          functionName: "bounties",
          args: [DEFAULT_TOKEN_CONTRACT],
        });

        console.log(`Bounty data for ${deployment.bountyContract}:`, bountyData);

        // Only include if there's actually a bounty (recipient is not zero address)
        if (bountyData && bountyData[0] !== "0x0000000000000000000000000000000000000000") {
          return {
            bountyContract: deployment.bountyContract,
            bountyId: 0, // Using 0 since these contracts use tokenContract as key
            tokenContract: DEFAULT_TOKEN_CONTRACT,
            lastMintedId: Number(bountyData[2]), // lastMintedId
            gasRefundAmount: bountyData[4], // minterReward
            claimedCount: 0, // We don't have a direct way to get claimed count from this contract
            maxClaims: Number(bountyData[3]), // artifactsToMint
            isActive: !bountyData[1], // !paused
            balance: bountyData[6], // balance
            createdAt: 0, // not available in this contract
            gasRefundRecipient: bountyData[0], // recipient
            owner: deployment.owner,
          } as BountyData;
        }
        return null;
      } catch (err) {
        console.log(`Error fetching bounty from ${deployment.bountyContract}:`, err);
        return null;
      }
    });

    const allBounties = await Promise.all(allBountiesPromises);
    return allBounties.filter((b): b is BountyData => b !== null);
  } catch (error) {
    console.error("Error fetching all bounties:", error);
    return [];
  }
}

export async function fetchAllActiveBounties(): Promise<BountyData[]> {
  const bounties = await fetchAllBounties();
  return bounties.filter(b => b.isActive && b.balance > 0n);
}