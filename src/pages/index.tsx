import TokenExplorer from "@/components/TokenExplorer";
import Head from "next/head";

export default function Home() {
  return (
    <>
      <Head>
        <title>Networked Nodes</title>
        <meta
          name="description"
          content="explore the latest creations on mint protocol"
        />
        <meta property="og:title" content="NetworkedNodes.art" />
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
      <div className="mt-4 xl:mt-8 px-4 lg:px-8 xl:px-12 py-4 border-t border-gray-200 border-solid w-full leading-tight">
        <p className="text-[12px] opacity-60 font-thin mt-1">
          permissionless front-end by{" "}
          <a
            href="https://twitter.com/ripe0x"
            target="_blank"
            rel="noreferrer"
            className="font-bold underline hover:no-underline"
          >
            ripe
          </a>
          . logo by{" "}
          <a
            href="https://x.com/rotter_daniel"
            target="_blank"
            rel="noreferrer"
            className="font-bold underline hover:no-underline"
          >
            daniel rotter
          </a>
        </p>
      </div>
    </>
  );
}
