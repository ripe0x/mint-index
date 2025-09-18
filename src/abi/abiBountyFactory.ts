export const abiBountyFactory = [
  {
    inputs: [],
    name: "deployBountyContract",
    outputs: [{ name: "bountyContract", type: "address" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "owner", type: "address" },
      { indexed: false, name: "bountyContract", type: "address" },
    ],
    name: "BountyContractDeployed",
    type: "event",
  },
] as const;