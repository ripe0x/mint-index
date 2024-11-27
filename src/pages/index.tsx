import TokenExplorer from "@/components/TokenExplorer";
import Head from "next/head";

export default function Home() {
  return (
    <>
      <Head>
        <title>Nodeworks</title>
        <meta
          name="description"
          content="explore the latest creations on mint protocol"
        />
        <meta property="og:title" content="Nodeworks.art" />
        <meta
          property="og:description"
          content="explore the latest creations on mint protocol"
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://networkednodes.art" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:site" content="@ripe0x" />
        <meta name="twitter:title" content="NetworkedNodes.art" />
        <meta
          name="twitter:description"
          content="explore the latest creations on mint protocol"
        />

        <link rel="icon" href="/networkednodes_black.svg" />
      </Head>
      <TokenExplorer />
    </>
  );
}
