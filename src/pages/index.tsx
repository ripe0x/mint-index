import TokenExplorer from "@/components/TokenExplorer";
import Head from "next/head";

export default function Home() {
  return (
    <>
      <Head>
        <title>networked nodes</title>
        <meta
          name="description"
          content="Explore the latest contract creations on mint protocol"
        />
        <link rel="icon" href="/favicon.svg" />
      </Head>
      <div className="flex flex-col row-start-2 items-center sm:items-start">
        <div className="px-4 lg:px-8 xl:px-12 py-4 2xl:py-8 w-full leading-tight">
          <h1 className="text-md text-gray-800 font-bold">
            NetworkedNodes.art
          </h1>
          <p className="text-[12px] opacity-60 font-thin mt-1">
            explore the latest creations on{" "}
            <a
              href="https://docs.mint.vv.xyz/"
              target="_blank"
              rel="noreferrer"
              className="font-bold underline hover:no-underline"
            >
              mint protocol
            </a>
          </p>
        </div>
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
          </p>
        </div>
      </div>
    </>
  );
}
