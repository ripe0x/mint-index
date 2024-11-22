export const EXTERNAL_MINT_BASE_URL = "https://networked.art";
let factoryAddress =
  "0xd717Fe677072807057B03705227EC3E3b467b670" as `0x${string}`;
let rpcUrl = `https://eth-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API}`; // Replace with your Alchemy/Infura key
let factoryDeploymentBlock = 21167599;

if (process.env.NEXT_PUBLIC_IS_TESTNET === "true") {
  factoryAddress =
    "0x750C5a6CFD40C9CaA48C31D87AC2a26101Acd517" as `0x${string}`;
  rpcUrl = `https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API}`;
  factoryDeploymentBlock = 7057962;
}

export const FACTORY_ADDRESS = factoryAddress;
export const RPC_URL = rpcUrl;
export const FACTORY_DEPLOYMENT_BLOCK = factoryDeploymentBlock;
