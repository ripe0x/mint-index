const { createPublicClient, http, parseAbiItem } = require('viem');
const { mainnet } = require('viem/chains');

const client = createPublicClient({
  chain: mainnet,
  transport: http('https://eth-mainnet.g.alchemy.com/v2/vCDlbqYLHrl_dZJkGmX2FgpAUpRs-iTI'),
});

const bountyContracts = [
  '0x97a1d061b062fcebb870d65c9db1734cc7035b3a',
  '0x51ffe643084c050db1b06806f9d6c6a5cbebb12a'
];

// Try different possible ABIs
const possibleABIs = {
  nextBountyId: {
    inputs: [],
    name: "nextBountyId",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  bounties: {
    inputs: [{ name: "", type: "uint256" }],
    name: "bounties",
    outputs: [
      { name: "tokenContract", type: "address" },
      { name: "lastMintedId", type: "uint256" },
      { name: "gasRefundAmount", type: "uint256" },
      { name: "claimedCount", type: "uint256" },
      { name: "maxClaims", type: "uint256" },
      { name: "isActive", type: "bool" },
      { name: "balance", type: "uint256" },
      { name: "createdAt", type: "uint256" },
      { name: "gasRefundRecipient", type: "address" },
    ],
    stateMutability: "view",
    type: "function",
  },
  // Maybe it uses a different function name?
  getBounty: {
    inputs: [{ name: "bountyId", type: "uint256" }],
    name: "getBounty",
    outputs: [
      { name: "", type: "tuple", components: [
        { name: "tokenContract", type: "address" },
        { name: "tokenId", type: "uint256" },
        { name: "gasRefundAmount", type: "uint256" },
        { name: "maxClaims", type: "uint256" },
        { name: "claimedCount", type: "uint256" },
        { name: "isActive", type: "bool" },
      ]},
    ],
    stateMutability: "view",
    type: "function",
  }
};

async function testContract(contractAddress) {
  console.log(`\nTesting contract: ${contractAddress}`);

  // Check if contract exists
  try {
    const code = await client.getBytecode({ address: contractAddress });
    console.log(`  Has bytecode: ${!!code && code !== '0x'}`);
  } catch (e) {
    console.log(`  Error checking bytecode: ${e.message}`);
    return;
  }

  // Try nextBountyId
  try {
    const nextId = await client.readContract({
      address: contractAddress,
      abi: [possibleABIs.nextBountyId],
      functionName: "nextBountyId",
    });
    console.log(`  nextBountyId: ${nextId}`);

    // If we got a nextBountyId, try to read bounty 0
    if (nextId > 0) {
      try {
        const bounty = await client.readContract({
          address: contractAddress,
          abi: [possibleABIs.bounties],
          functionName: "bounties",
          args: [0n],
        });
        console.log(`  Bounty 0:`, bounty);
      } catch (e) {
        console.log(`  Error reading bounty 0: ${e.message}`);
      }
    }
  } catch (e) {
    console.log(`  No nextBountyId function or error: ${e.message.split('\n')[0]}`);
  }

  // Try getBounty
  try {
    const bounty = await client.readContract({
      address: contractAddress,
      abi: [possibleABIs.getBounty],
      functionName: "getBounty",
      args: [0n],
    });
    console.log(`  getBounty(0):`, bounty);
  } catch (e) {
    console.log(`  No getBounty function`);
  }

  // Get some transaction history to understand what functions are being called
  console.log(`  Check on Etherscan: https://etherscan.io/address/${contractAddress}#code`);
}

async function main() {
  for (const contract of bountyContracts) {
    await testContract(contract);
  }
}

main();