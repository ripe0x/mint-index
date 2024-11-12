import { createPublicClient, http, parseAbiItem } from "viem";
import { mainnet } from "viem/chains";

const FACTORY_ADDRESS = "0xd717Fe677072807057B03705227EC3E3b467b670";
// Use a specific RPC URL (you'll need to replace this with your own)
const RPC_URL = `https://eth-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API}`; // Replace with your Alchemy/Infura key

const client = createPublicClient({
  chain: mainnet,
  transport: http(RPC_URL),
});

export async function fetchFactoryEvents() {
  try {
    // Let's try a specific block range where we know events exist
    // Based on Etherscan events
    const currentBlockNumber = await client.getBlockNumber();
    const fromBlockNumber = BigInt(21167599); // contract deployment
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
