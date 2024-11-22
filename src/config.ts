import { createPublicClient } from "viem";
import { http, createConfig } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";

export const config = createConfig({
  chains: [mainnet],
  transports: {
    [mainnet.id]: http(),
  },
});

export const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http(`
      https://eth-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API}
    `),
});

export const clientSepolia = createPublicClient({
  chain: sepolia,
  transport: http(`
      https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API}
    `),
});

export const client =
  process.env.NEXT_PUBLIC_IS_TESTNET === "true" ? clientSepolia : mainnetClient;
