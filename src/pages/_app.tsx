import type { AppProps } from "next/app";
import "../styles/global.css";
import "@rainbow-me/rainbowkit/styles.css";
import {
  RainbowKitProvider,
  getDefaultConfig,
  midnightTheme,
} from "@rainbow-me/rainbowkit";
import { mainnet, sepolia } from "viem/chains";
import { WagmiProvider } from "wagmi";
import { fallback, http } from "viem"; // Changed this import
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { IBM_Plex_Mono } from "next/font/google";
import Layout from "@/components/Layout";

const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
const INFURA_KEY = process.env.NEXT_PUBLIC_INFURA_API_KEY;

const mainnetTransports = fallback([
  http(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`),
  http(`https://mainnet.infura.io/v3/${INFURA_KEY}`),
  http(),
]);

const sepoliaTransports = fallback([
  http(`https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`),
  http(`https://sepolia.infura.io/v3/${INFURA_KEY}`),
  http(),
]);

const config = getDefaultConfig({
  appName: "My RainbowKit App",
  projectId: "YOUR_PROJECT_ID",
  chains: [process.env.NEXT_PUBLIC_IS_TESTNET ? sepolia : mainnet],
  ssr: false,
  transports: {
    [mainnet.id]: mainnetTransports,
    [sepolia.id]: sepoliaTransports,
  },
});

// Optional: verify env vars are loaded
if (
  !process.env.NEXT_PUBLIC_ALCHEMY_API_KEY ||
  !process.env.NEXT_PUBLIC_INFURA_API_KEY
) {
  throw new Error("Missing environment variables");
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000, // 5 minutes before refetch
      gcTime: 10 * 60 * 1000,   // 10 minutes cache retention
    },
  },
});
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["300", "400"],
});

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={midnightTheme({
            accentColor: "#fff",
            accentColorForeground: "black",
            borderRadius: "small",
          })}
        >
          <Layout fontClass={ibmPlexMono.className}>
            <Component {...pageProps} />
          </Layout>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
