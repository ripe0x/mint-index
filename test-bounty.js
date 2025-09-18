const { createPublicClient, http } = require('viem');
const { mainnet } = require('viem/chains');

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
});

// The known bounty contract that user mentioned
const knownBountyContract = "0x97A1D061b062FCeBB870D65C9DB1734cC7035b3A";

async function testBounty() {
  // Try to read the owner
  try {
    const owner = await client.readContract({
      address: knownBountyContract,
      abi: [
        {
          inputs: [],
          name: "owner",
          outputs: [{ name: "", type: "address" }],
          stateMutability: "view",
          type: "function",
        },
      ],
      functionName: "owner",
    });
    console.log("Owner of known bounty contract:", owner);
  } catch (e) {
    console.error("Error reading owner:", e);
  }

  // Try to check if it has bounties with the old ABI
  try {
    const bountyData = await client.readContract({
      address: knownBountyContract,
      abi: [
        {
          inputs: [{ name: "", type: "address" }],
          name: "bounties",
          outputs: [
            { name: "recipient", type: "address" },
            { name: "paused", type: "bool" },
            { name: "lastMintedId", type: "uint96" },
            { name: "artifactsToMint", type: "uint256" },
            { name: "minterReward", type: "uint256" },
            { name: "maxArtifactPrice", type: "uint256" },
            { name: "balance", type: "uint256" },
          ],
          stateMutability: "view",
          type: "function",
        },
      ],
      functionName: "bounties",
      args: ["0xBA1901b542Aa58f181F7ae18eD6Cd79FdA779C62"], // DEFAULT_TOKEN_CONTRACT
    });
    console.log("Bounty data for DEFAULT_TOKEN_CONTRACT:", bountyData);
  } catch (e) {
    console.error("Error reading bounty data:", e.message);
  }
}

testBounty();