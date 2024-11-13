import TokenExplorer from "@/components/TokenExplorer";
import Head from "next/head";

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

      <div className="px-4 lg:px-8 xl:px-12 py-4 border-b border-gray-200 border-solid w-full leading-tight">
        <h1 className="text-md text-gray-800 font-bold">Mint protocol index</h1>
        <p className="text-sm text-gray-600">
          Simple ui to see the latest creations on mint protocol.
          <a href="https://docs.mint.vv.xyz/">learn more about the protocol</a>
        </p>
      </div>
      <TokenExplorer />
      <div className="px-4 lg:px-8 xl:px-12 py-4 border-t border-gray-200 border-solid w-full leading-tight">
        <p className="text-sm text-gray-600">
          this website is a simple ui to see the latest creations on{" "}
          <a
            href="https://docs.mint.vv.xyz/"
            target="_blank"
            rel="noreferrer"
            className="font-bold underline hover:no-underline"
          >
            mint protocol
          </a>
        </p>
        <p className="text-sm text-gray-600">
          created by{" "}
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
    </>
  );
}
