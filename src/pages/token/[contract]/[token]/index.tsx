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
  timestamp: number;
  txHash: string;
};

export default function TokenPage() {
  const router = useRouter();
  const { contract, token } = router.query;
  const contractAddress = contract as `0x${string}`;
  const tokenId = token as string;

  const [mintHistory, setMintHistory] = useState<MintEvent[]>([]);
  const [tokenData, setTokenData] = useState<TokenData>();
  const [metadata, setMetadata] = useState<TokenMetadata | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const { error, handleError } = useErrorHandler();
  const [totalMinted, setTotalMinted] = useState<number>(0);
  const [deployerAddress, setDeployerAddress] = useState<`0x${string}`>();
  // const [lastBlock, setLastBlock] = useState<bigint>(BigInt(0));

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
        // TODO: limit to the last x events to prevent rate limiting
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

  // async function fetchMetadata(blockNumber: bigint, baseFeePerGas: bigint) {
  //   if (!contractAddress || !tokenId) return;

  //   console.log("fetchMetadata", block.data);

  //   try {
  //     const tokenUri = await client.readContract({
  //       address: contractAddress,
  //       abi: abi1155,
  //       functionName: "uri",
  //       args: [BigInt(tokenId)],
  //       blockNumber: blockNumber,
  //       // @ts-expect-error - `gasPrice` is not in the type
  //       gasPrice: baseFeePerGas,
  //     });

  //     const response = await fetch(tokenUri);
  //     const metadata = await response.json();
  //     setMetadata(metadata);
  //   } catch (err) {
  //     handleError(err);
  //   }
  // }

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
        // rendererUri
        // const tokenUri = (await client.readContract({
        //   address:
        //     "0x6DE0A1bF17a3671cc85FF5915E28b266C22798Fd" as `0x${string}`,
        //   abi: abiGasPriceRenderer,
        //   functionName: "uri",
        //   args: [BigInt(tokenId), details],
        //   blockNumber,
        //   // @ts-expect-error - `gasPrice` is not in the type
        //   gasPrice: block.baseFeePerGas,
        // })) as string;
        // console.log("tokenUri", tokenUri);

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
          data: Number(details[6]),
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
        // const logs = await fetchLogsInRange(
        //   contractAddress,
        //   Number(tokenId),
        //   0,
        //   0,
        //   3
        // );
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
            const txHash = event.transactionHash;
            return {
              address: event.args.minter as `0x${string}`,
              amount: Number(event.args.amount),
              price: BigInt(0), // or any appropriate value
              timestamp: Number(block.timestamp),
              txHash,
            };
          })
        );

        setMintHistory(history.sort((a, b) => b.timestamp - a.timestamp));

        setTotalMinted(total);
      } catch (err) {
        console.error("Error fetching mint events:", err);
      }
    };

    fetchTotalMinted();
    setLoading(true);
    fetchTokenData();
    // setLastBlock(block.data?.number || BigInt(0));

    return () => {
      mounted = false;
    };
  }, [tokenIdentifier, handleError, contractAddress, tokenId]);

  // if token's data = 1, refetch the metadata on each block
  // useEffect(() => {
  //   console.log("tokenData", tokenData);
  //   if (tokenData?.data === 1 && block.data?.number !== lastBlock) {
  //     fetchMetadata(block.data?.number, block.baseFeePerGas);
  //     setLastBlock(block.data?.number || BigInt(0));
  //   }
  // }, [tokenData, block]);

  if (!tokenData || loading)
    return (
      <div className="px-4 lg:px-8 text-[12px] xl:px-12 py-4 opacity-60 w-full text-center">
        Loading token data...
      </div>
    );
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
      {/* <Header /> */}
      <div className="px-4 lg:px-8 xl:px-12 py-0 w-full">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="lg:w-2/3">
            <div className="w-full aspect-square">{displayContent}</div>
          </div>

          <div className="lg:w-1/3">
            <div className="mb-2">
              <h1 className="text-md">{metadata?.name || tokenData.name}</h1>
              <p className="text-[12px] opacity-80">
                By <DisplayName address={deployerAddress} />
              </p>
            </div>

            <p className="text-[12px] opacity-70">{metadata?.description}</p>
            <hr className="my-4" />
            <div className="text-[12px] mt-4 mb-2">
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
            {isMintActive && (
              <TokenMinter
                contractAddress={contractAddress as `0x${string}`}
                tokenId={Number(tokenId)}
              />
            )}
            <hr className="my-4" />
            <div className="mt-4">
              <div className="space-y-3">
                {mintHistory.map((event, i) => (
                  <a
                    key={i}
                    className="flex justify-between items-center text-[12px] opacity-70 hover:opacity-90"
                    href={`https://etherscan.io/tx/${event.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <div>
                      <DisplayName address={event.address as `0x${string}`} />
                      <span className="text-gray-500 ml-2">
                        {event.amount}×
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-gray-500">
                        {new Date(event.timestamp * 1000).toLocaleString()}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
