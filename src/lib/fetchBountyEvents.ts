import { client } from "@/config";
import { Address, parseAbiItem } from "viem";

const FACTORY_ADDRESS = "0x1Bf79888027B7EeE2e5B30890DbfD9157EB4C06a";

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
    // Try multiple block ranges to find events
    const blockRanges = [
      { from: 21400000n, to: "latest" as const },  // Recent blocks
      { from: 21200000n, to: 21400000n },  // Earlier range
      { from: 21000000n, to: 21200000n },  // Even earlier
    ];

    console.log("Fetching bounty events from factory:", FACTORY_ADDRESS);
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
        const logs = await client.getLogs({
          address: FACTORY_ADDRESS as Address,
          event: parseAbiItem('event BountyContractDeployed(address indexed owner, address bountyContract)'),
          fromBlock: range.from,
          toBlock: range.to,
          args: ownerFilter ? { owner: ownerFilter } : undefined,
        });

        if (logs.length > 0) {
          console.log(`Found ${logs.length} events in range ${range.from}-${range.to}`);

          // Only add logs we haven't seen before (avoid duplicates)
          for (const log of logs) {
            // The bountyContract address is in topics[2] (third topic)
            // Need to decode it from the topic format (32-byte hex string)
            const topics = log.topics as readonly string[] | undefined;
            const contractAddrFromTopic = topics && topics.length > 2 ? topics[2] : undefined;
            const logArgs = log.args as { owner?: Address; bountyContract?: Address } | undefined;
            const contractAddr = contractAddrFromTopic
              ? `0x${contractAddrFromTopic.slice(-40)}` as Address  // Take last 40 chars (20 bytes)
              : logArgs?.bountyContract;

            if (contractAddr && !seenContracts.has(contractAddr.toLowerCase())) {
              seenContracts.add(contractAddr.toLowerCase());

              // Reconstruct the log with proper args
              const enhancedLog = {
                ...log,
                args: {
                  owner: logArgs?.owner || (topics && topics.length > 1 ? `0x${topics[1].slice(-40)}` as Address : "0x0" as Address),
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