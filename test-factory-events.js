const { createPublicClient, http, parseAbiItem } = require('viem');
const { mainnet } = require('viem/chains');

const client = createPublicClient({
  chain: mainnet,
  transport: http('https://eth-mainnet.g.alchemy.com/v2/vCDlbqYLHrl_dZJkGmX2FgpAUpRs-iTI'),
});

const FACTORY_ADDRESS = "0x1Bf79888027B7EeE2e5B30890DbfD9157EB4C06a";

async function testFactory() {
  console.log("Checking factory events from:", FACTORY_ADDRESS);

  try {
    // Try to get recent events
    const logs = await client.getLogs({
      address: FACTORY_ADDRESS,
      event: parseAbiItem('event BountyContractDeployed(address indexed owner, address bountyContract)'),
      fromBlock: 21400000n,
      toBlock: 'latest',
    });

    console.log(`Found ${logs.length} BountyContractDeployed events`);

    if (logs.length > 0) {
      console.log("First few events:");
      logs.slice(0, 3).forEach((log, i) => {
        // bountyContract is in topics[2] (third topic) as a 32-byte hex
        const bountyContractFromTopic = log.topics && log.topics[2]
          ? `0x${log.topics[2].slice(-40)}` // Take last 40 chars (20 bytes)
          : undefined;

        console.log(`Event ${i}:`, {
          owner: log.args.owner,
          bountyContract: bountyContractFromTopic || log.args.bountyContract,
          blockNumber: log.blockNumber,
          topics: log.topics,
        });
      });
    }
  } catch (e) {
    console.error("Error fetching events:", e.message);
  }

  // Also try to check if the factory exists
  try {
    const code = await client.getBytecode({ address: FACTORY_ADDRESS });
    console.log("Factory contract has bytecode:", !!code && code !== '0x');
  } catch (e) {
    console.error("Error checking factory:", e);
  }
}

testFactory();