import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config } from "@/config";
import { WagmiProvider } from "wagmi";
import ContractExplorer from "@/components/ContractExplorer";
import Head from "next/head";

const queryClient = new QueryClient();

export default function Home() {
  return (
    <>
      <Head>
        <title>Mint protocol index</title>
        <meta
          name="description"
          content="Explore the latest contract creations on mint protocol"
        />
      </Head>

      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
        <ContractExplorer />
      </main>
    </>
  );
}
