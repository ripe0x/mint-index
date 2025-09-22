import { client } from "@/config";
import { Address, parseAbiItem } from "viem";
import { abiMintBountyNew } from "@/abi/abiMintBountyNew";
import { BountyData } from "@/types/bounty";

const BOUNTY_FACTORY_ADDRESS = "0x1Bf79888027B7EeE2e5B30890DbfD9157EB4C06a";
const TOKEN_FACTORY_ADDRESS = "0xd717Fe677072807057B03705227EC3E3b467b670";

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
    // Start from block 21385383 as specified
    const blockRanges = [
      { from: 21385383n, to: "latest" as const },  // From the specified starting block
    ];

    console.log("Fetching bounty events from factory:", BOUNTY_FACTORY_ADDRESS);
    console.log("Owner filter:", ownerFilter);

    const allLogs: Array<{
      args: { owner?: Address; bountyContract?: Address };
      blockNumber: bigint;
      transactionHash: `0x${string}`;
      topics?: readonly string[];
    }> = [];
    const seenContracts = new Set<string>();

    for (const range of blockRanges) {
      try {
        console.log(`Checking range ${range.from}-${range.to} for factory ${BOUNTY_FACTORY_ADDRESS}`);
        const logs = await client.getLogs({
          address: BOUNTY_FACTORY_ADDRESS as Address,
          event: parseAbiItem('event BountyContractDeployed(address indexed owner, address indexed bountyContract)'),
          fromBlock: range.from,
          toBlock: range.to,
          args: ownerFilter ? { owner: ownerFilter } : undefined,
        });

        console.log(`Found ${logs.length} events in range ${range.from}-${range.to}`);
        if (logs.length > 0) {

          // Only add logs we haven't seen before (avoid duplicates)
          for (const log of logs) {
            // The bountyContract address is indexed, so it's in topics[2] (third topic)
            const topics = log.topics as readonly string[] | undefined;
            const contractAddr = topics && topics.length > 2
              ? `0x${topics[2].slice(-40)}` as Address  // Take last 40 chars (20 bytes)
              : undefined;

            if (contractAddr && !seenContracts.has(contractAddr.toLowerCase())) {
              seenContracts.add(contractAddr.toLowerCase());

              // Reconstruct the log with proper args
              const owner = log.args?.owner || (topics && topics.length > 1 ? `0x${topics[1].slice(-40)}` as Address : "0x0" as Address);
              const enhancedLog = {
                ...log,
                args: {
                  owner,
                  bountyContract: contractAddr
                }
              };

              allLogs.push(enhancedLog);
            }
          }
        }
      } catch (err) {
        console.error(`Error fetching range ${range.from}-${range.to}:`, err);
        // Don't continue to other ranges if we hit an error
        break;
      }
    }

    console.log(`Found ${allLogs.length} unique bounty contracts`);

    const results = allLogs.map((log) => {
      // Safely access log.args with proper typing
      const args = log.args;
      return {
        owner: args.owner || ("0x0000000000000000000000000000000000000000" as Address),
        bountyContract: args.bountyContract || ("0x0000000000000000000000000000000000000000" as Address),
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
      };
    }).filter(r => r.bountyContract !== "0x0000000000000000000000000000000000000000");

    return results;
  } catch (error) {
    console.error("Error fetching bounty factory events:", error);
    return [];
  }
}

export async function fetchAllActiveBounties(): Promise<BountyData[]> {
  return fetchAllBounties(true);
}

// Fetch all token contracts deployed from the Mint token factory
export async function fetchAllTokenContracts(): Promise<Address[]> {
  try {
    console.log("Fetching all token contracts from factory:", TOKEN_FACTORY_ADDRESS);

    // The Mint factory emits Created events when new token contracts are deployed
    const logs = await client.getLogs({
      address: TOKEN_FACTORY_ADDRESS as Address,
      event: parseAbiItem('event Created(address indexed ownerAddress, address contractAddress)'),
      fromBlock: 21385383n,
      toBlock: "latest",
    });

    const tokenContracts = logs
      .map(log => log.args?.contractAddress)
      .filter((addr): addr is Address => !!addr);

    console.log(`Found ${tokenContracts.length} token contracts from factory`);
    return tokenContracts;
  } catch (error) {
    console.error("Error fetching token contracts from factory:", error);
    return [];
  }
}

export async function fetchAllBounties(activeOnly: boolean = false): Promise<BountyData[]> {
  try {
    // First get all deployed bounty contracts from factory
    const deployedContracts = await fetchBountyFactoryEvents();
    console.log(`Found ${deployedContracts.length} deployed bounty contracts from factory`);

    if (deployedContracts.length === 0) {
      return [];
    }

    // Get all token contracts from the Mint factory
    const allTokenContracts = await fetchAllTokenContracts();

    // We'll check all token contracts from the factory
    // This ensures we don't miss any bounties
    const tokenContracts = new Set<Address>(allTokenContracts);

    // Also add some known contracts in case factory fetch fails
    tokenContracts.add("0xBA1901b542Aa58f181F7ae18eD6Cd79FdA779C62" as Address);
    tokenContracts.add("0xb437c5228d75A0769E2318Cf5E0Aa893058966CA" as Address);

    console.log(`Checking ${tokenContracts.size} unique token contracts with ${deployedContracts.length} bounty contracts`);
    console.log("Token contracts:", Array.from(tokenContracts));

    // Now check each combination of bounty contract + token contract
    const allBountiesPromises = deployedContracts.flatMap(deployment =>
      Array.from(tokenContracts).map(async (tokenContract) => {
        try {
          // Read bounty data for this token contract
          const bountyData = await client.readContract({
            address: deployment.bountyContract,
            abi: abiMintBountyNew,
            functionName: "bounties",
            args: [tokenContract],
          });

          // Only include if there's actually a bounty (recipient is not zero address)
          if (bountyData && bountyData[0] !== "0x0000000000000000000000000000000000000000") {
            const isActive = !bountyData[1]; // !paused
            const hasBalance = bountyData[6] > 0n; // balance > 0

            // Filter by active status if requested
            if (activeOnly && (!isActive || !hasBalance)) {
              return null;
            }

            return {
              bountyContract: deployment.bountyContract,
              bountyId: 0, // Using 0 since these contracts use tokenContract as key
              tokenContract: tokenContract,
              lastMintedId: Number(bountyData[2]), // lastMintedId
              gasRefundAmount: bountyData[4], // minterReward (number of tokens for claimer)
              claimedCount: 0, // We don't have a direct way to get claimed count from this contract
              maxClaims: Number(bountyData[3]), // artifactsToMint (total tokens to mint)
              isActive: isActive,
              balance: bountyData[6], // balance
              createdAt: 0, // not available in this contract
              gasRefundRecipient: bountyData[0], // recipient
              owner: deployment.owner,
            } as BountyData;
          }
          return null;
        } catch (err) {
          console.log(`Error fetching bounty from ${deployment.bountyContract} for token ${tokenContract}:`, err);
          return null;
        }
      })
    );

    const allBounties = await Promise.all(allBountiesPromises);
    return allBounties.filter((b): b is BountyData => b !== null);
  } catch (error) {
    console.error("Error fetching all bounties:", error);
    return [];
  }
}