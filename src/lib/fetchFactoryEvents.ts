import { createPublicClient, http, parseAbiItem } from "viem";
import { mainnet } from "viem/chains";
import {
  RPC_URL,
  FACTORY_ADDRESS,
  FACTORY_DEPLOYMENT_BLOCK,
} from "./constants";

const client = createPublicClient({
  chain: mainnet,
  transport: http(RPC_URL),
});

export async function fetchFactoryEvents() {
  try {
    // Let's try a specific block range where we know events exist
    // Based on Etherscan events
    const currentBlockNumber = await client.getBlockNumber();
    const fromBlockNumber = BigInt(FACTORY_DEPLOYMENT_BLOCK); // contract deployment
    const toBlockNumber = currentBlockNumber;

    // First, let's try getting just the Created events
    const createdLogs = await client.getLogs({
      address: FACTORY_ADDRESS,
      event: parseAbiItem(
        "event Created(address indexed ownerAddress, address contractAddress)"
      ),
      fromBlock: fromBlockNumber,
      toBlock: toBlockNumber,
    });

    // If we're not getting Created events, let's try getting ALL events
    const allLogs = await client.getLogs({
      address: FACTORY_ADDRESS,
      fromBlock: fromBlockNumber,
      toBlock: toBlockNumber,
    });

    // Parse the events if we got any
    const parsedEvents = allLogs.map((log) => ({
      blockNumber: Number(log.blockNumber),
      transactionHash: log.transactionHash,
      topics: log.topics,
      data: log.data,
    }));

    return {
      createdEvents: createdLogs,
      allEvents: allLogs,
      parsedEvents,
    };
  } catch (error) {
    console.error("Error fetching events:", error);
    throw error;
  }
}
