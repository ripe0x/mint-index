import type { AppProps } from "next/app";
import "../styles/global.css";
import "@rainbow-me/rainbowkit/styles.css";

// RPC Call Counter (development only)
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  const rpcStats = { total: 0, methods: {} as Record<string, number> };
  const originalFetch = window.fetch;

  window.fetch = async (...args) => {
    const [url, options] = args;
    const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : "";

    // Check if this is an RPC call (Alchemy, Infura, or public RPC)
    if (urlStr.includes("alchemy.com") || urlStr.includes("infura.io") || urlStr.includes("cloudflare-eth")) {
      rpcStats.total++;

      // Try to parse the method name
      try {
        const body = options?.body;
        if (body && typeof body === "string") {
          const parsed = JSON.parse(body);
          const method = parsed.method || "unknown";
          rpcStats.methods[method] = (rpcStats.methods[method] || 0) + 1;
        }
      } catch {}

      // Log summary every 2 seconds (debounced)
      clearTimeout((window as unknown as { __rpcTimer?: ReturnType<typeof setTimeout> }).__rpcTimer);
      (window as unknown as { __rpcTimer?: ReturnType<typeof setTimeout> }).__rpcTimer = setTimeout(() => {
        console.log(
          `%c[RPC Stats] Total: ${rpcStats.total} calls`,
          "background: #222; color: #0f0; padding: 4px 8px; border-radius: 4px;"
        );
        console.table(rpcStats.methods);
      }, 2000);
    }

    return originalFetch(...args);
  };
}
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
