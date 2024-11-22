import { useRouter } from "next/router";
import { abi1155 } from "@/abi/abi1155";
import { parseAbiItem } from "viem";
import TokenMinter from "@/components/TokenMinter";
import { useEffect, useMemo, useState } from "react";
import { client } from "@/config";

import { useErrorHandler } from "@/app/utils/errors";
import { TokenData, TokenMetadata } from "@/types";
import { CountdownTimer } from "@/components/CountdownTimer";
import Head from "next/head";
import Header from "@/components/Header";
import DisplayName from "@/components/DisplayName";
import { FACTORY_ADDRESS, FACTORY_DEPLOYMENT_BLOCK } from "@/lib/constants";

const getDisplayContent = (
  metadata: TokenMetadata | null,
  tokenData: TokenData
) => {
  if (
    metadata?.animation_url &&
    (metadata.animation_url.includes("html") ||
      metadata.animation_url.includes("htm"))
  ) {
    return (
      <iframe
        src={metadata.animation_url}
        className="w-full h-full"
        frameBorder="0"
        title={tokenData.name}
      />
    );
  }
  if (
    metadata?.animation_url &&
    (metadata.animation_url.includes("mp4") ||
      metadata.animation_url.includes("webm"))
  ) {
    return (
      <video
        src={metadata.animation_url}
        autoPlay
        loop
        muted
        className="w-full"
      />
    );
  }

  if (metadata?.image) {
    return <img src={metadata.image} alt={tokenData.name} className="w-full" />;
  }

  return null;
};

type MintEvent = {
  address: string;
  amount: number;
  // price: bigint;
  timestamp: number;
};

export default function TokenPage() {
  const router = useRouter();
  console.log("router", router);
  const { contract, token } = router.query;
  const contractAddress = contract as `0x${string}`;
  const tokenId = token as string;

  console.log("contractAddress", contractAddress);
  console.log("tokenId", tokenId);
  const [mintHistory, setMintHistory] = useState<MintEvent[]>([]);
  // const [baseFee, setBaseFee] = useState<bigint>(BigInt(0));

  const [tokenData, setTokenData] = useState<TokenData>();
  const [metadata, setMetadata] = useState<TokenMetadata | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const { error, handleError } = useErrorHandler();
  const [totalMinted, setTotalMinted] = useState<number>(0);
  const [deployerAddress, setDeployerAddress] = useState<`0x${string}`>();

  // Memoize the token identifier to prevent unnecessary re-fetches
  const tokenIdentifier = useMemo(
    () => `${contractAddress}-${tokenId}`,
    [contractAddress, tokenId]
  );

  // Get deployer address from factory events
  useEffect(() => {
    if (!contractAddress) return;

    async function fetchDeployer() {
      try {
        const events = await client.getLogs({
          address: FACTORY_ADDRESS,
          event: parseAbiItem(
            "event Created(address indexed ownerAddress, address contractAddress)"
          ),
          fromBlock: BigInt(FACTORY_DEPLOYMENT_BLOCK),
          toBlock: "latest",
        });
        console.log("events", events);
        // find the event that matches the contract address
        const event = events.find(
          (event) =>
            event.args.contractAddress?.toLowerCase() ===
            contractAddress.toLowerCase()
        );
        if (event) {
          setDeployerAddress(event.args.ownerAddress as `0x${string}`);
        }
      } catch (err) {
        console.error("Error fetching deployer:", err);
      }
    }

    fetchDeployer();
  }, [contractAddress]);

  useEffect(() => {
    let mounted = true;

    async function fetchTokenData() {
      if (!mounted || !contractAddress || !tokenId) return;

      try {
        const baseFee = await client.getBlock({
          blockTag: "latest",
        });
        const blockNumber = baseFee.number;

        // Get token details
        const details = await client.readContract({
          address: contractAddress,
          abi: abi1155,
          functionName: "get",
          args: [BigInt(tokenId)],
        });

        if (!mounted) return;

        const block = await client.getBlock({
          blockNumber: BigInt(blockNumber),
        });

        const tokenUri = await client.readContract({
          address: contractAddress,
          abi: abi1155,
          functionName: "uri",
          args: [BigInt(tokenId)],
          blockNumber,
          // @ts-expect-error - `gasPrice` is not in the type
          gasPrice: block.baseFeePerGas,
        });

        if (!mounted) return;

        // Check mint status
        const mintOpenUntil = await client.readContract({
          address: contractAddress,
          abi: abi1155,
          functionName: "mintOpenUntil",
          args: [BigInt(tokenId)],
        });

        if (!mounted) return;

        const data = {
          name: details[0],
          description: details[1],
          mintedBlock: Number(details[4]),
          closeAt: Number(details[5]),
          mintOpenUntil: Number(mintOpenUntil),
        };

        setTokenData(data);

        // Fetch metadata separately
        try {
          const response = await fetch(tokenUri);
          const metadata = await response.json();
          if (mounted) {
            setMetadata(metadata);
          }
        } catch (err) {
          handleError(err);
        }

        if (mounted) {
          setLoading(false);
        }
      } catch (err) {
        handleError(err);
        if (mounted) {
          setLoading(false);
        }
      }
    }
    const fetchTotalMinted = async () => {
      if (!tokenId) return;

      try {
        const logs = await client.getLogs({
          address: contractAddress,
          event: {
            type: "event",
            name: "NewMint",
            inputs: [
              { type: "uint256", name: "tokenId", indexed: true },
              { type: "uint256", name: "unitPrice", indexed: false },
              { type: "uint256", name: "amount", indexed: false },
              { type: "address", name: "minter", indexed: false },
            ],
          },
          args: {
            tokenId: BigInt(tokenId),
          },
          fromBlock: BigInt(0),
        });

        const total = logs.reduce((acc, log) => {
          const amount = Number(log.args.amount || BigInt(0));
          return acc + amount;
        }, 0);

        const history = await Promise.all(
          logs.map(async (event) => {
            const block = await client.getBlock({
              blockNumber: event.blockNumber,
            });
            return {
              address: event.args.minter as `0x${string}`,
              amount: Number(event.args.amount),
              // price: BigInt(0), // or any appropriate value
              timestamp: Number(block.timestamp),
            };
          })
        );

        setMintHistory(history.sort((a, b) => b.timestamp - a.timestamp));

        setTotalMinted(total);
      } catch (err) {
        console.error("Error fetching mint events:", err);
      }
    };
    // async function fetchMintHistory() {
    //   if (!tokenId) return;
    //   const events = await client.getLogs({
    //     address: contractAddress as `0x${string}`,
    //     event: parseAbiItem(
    //       "event NewMint(address indexed minter, uint256 indexed tokenId, uint256 amount)"
    //     ),
    //     fromBlock: BigInt(0),
    //     toBlock: "latest",
    //     args: {
    //       tokenId: BigInt(tokenId as string),
    //     },
    //   });
    //   console.log("mint history events", events);

    //   const history = await Promise.all(
    //     events.map(async (event) => {
    //       const block = await client.getBlock({
    //         blockNumber: event.blockNumber,
    //       });
    //       return {
    //         address: event.args.minter as `0x${string}`,
    //         amount: Number(event.args.amount),
    //         price: BigInt(0), // or any appropriate value
    //         timestamp: Number(block.timestamp),
    //       };
    //     })
    //   );

    //   setMintHistory(history.sort((a, b) => b.timestamp - a.timestamp));
    // }

    // fetchMintHistory();
    fetchTotalMinted();
    setLoading(true);
    fetchTokenData();

    return () => {
      mounted = false;
    };
  }, [tokenIdentifier, handleError, contractAddress, tokenId]);

  if (!tokenData || loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  const displayContent = getDisplayContent(metadata, tokenData);

  const now = Math.floor(Date.now() / 1000);
  const isMintActive = tokenData.mintOpenUntil > now;
  const closeDate = new Date(tokenData.mintOpenUntil * 1000);

  return (
    <>
      <Head>
        <title>{tokenData.name} | Networked Nodes</title>
        <meta name="description" content={metadata?.description} />
        <meta
          property="og:title"
          content={`${tokenData.name} | Networked Nodes`}
        />
        <meta property="og:description" content={metadata?.description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://networkednodes.art" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:site" content="@ripe0x" />
        <meta
          name="twitter:title"
          content={`${tokenData.name} | Networked Nodes`}
        />
        <meta name="twitter:description" content={metadata?.description} />

        <link rel="icon" href="/networkednodes_black.svg" />
      </Head>
      <Header />
      <div className="px-4 lg:px-8 xl:px-12 py-0 w-full">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="lg:w-2/3">
            <div className="w-full aspect-square">{displayContent}</div>
          </div>

          <div className="lg:w-1/3 space-y-6">
            <div>
              <h1 className="text-md">{metadata?.name || tokenData.name}</h1>
              <p className="text-[12px] opacity-80">
                By <DisplayName address={deployerAddress} />
              </p>
            </div>

            <p className="text-gray-700">{metadata?.description}</p>

            <div className="text-[12px]">
              {isMintActive ? (
                <>
                  <CountdownTimer
                    closeAt={tokenData.mintOpenUntil}
                    totalMinted={totalMinted}
                  />
                </>
              ) : (
                <>
                  <div className="flex justify-between">
                    <p className="text-[12px] opacity-60">
                      {totalMinted.toLocaleString()} minted
                    </p>
                    <p className="text-[12px] opacity-60 text-end">
                      closed on {closeDate.toLocaleDateString()}
                    </p>
                  </div>
                </>
              )}
            </div>
            <TokenMinter
              contractAddress={contractAddress as `0x${string}`}
              tokenId={Number(tokenId)}
            />
            <hr className="my-2" />
            <div className="mt-2">
              <h2 className="text-xs  mb-4">Mint Timeline</h2>
              <div className="space-y-3">
                {mintHistory.map((event, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center text-sm"
                  >
                    <div>
                      <DisplayName address={event.address as `0x${string}`} />
                      <span className="text-gray-500 ml-2">
                        {event.amount}×
                      </span>
                    </div>
                    <div className="text-right">
                      {/* <div>{formatEther(event.price)} ETH</div> */}
                      <div className="text-gray-500">
                        {new Date(event.timestamp * 1000).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
