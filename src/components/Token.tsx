import { abi1155 } from "@/abi/abi1155";
import { useState, useEffect, useMemo, useRef } from "react";
import { Address } from "viem";
import { client } from "@/config";
import { CountdownTimer } from "./CountdownTimer";
import type { TokenData, TokenMetadata } from "../types";
import { useErrorHandler } from "@/app/utils/errors";
import DisplayName from "./DisplayName";
import Link from "next/link";

type Props = {
  contractAddress: Address;
  tokenId: number;
  deployerAddress: Address;
};

export const Token = ({ contractAddress, tokenId, deployerAddress }: Props) => {
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [metadata, setMetadata] = useState<TokenMetadata | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isTextTruncated, setIsTextTruncated] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);
  const { error, handleError } = useErrorHandler();
  const [totalMinted, setTotalMinted] = useState<number>(0);

  // Memoize the token identifier to prevent unnecessary re-fetches
  const tokenIdentifier = useMemo(
    () => `${contractAddress}-${tokenId}`,
    [contractAddress, tokenId]
  );

  useEffect(() => {
    let mounted = true;

    async function fetchTokenData() {
      if (!mounted) return;

      try {
        const block = await client.getBlock();
        // Get token details
        const details = await client.readContract({
          address: contractAddress,
          abi: abi1155,
          functionName: "get",
          args: [BigInt(tokenId)],
        });

        if (!mounted) return;

        // Get token URI
        const tokenUri = await client.readContract({
          address: contractAddress,
          abi: abi1155,
          functionName: "uri",
          args: [BigInt(tokenId)],
          blockNumber: block.number,
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

    setLoading(true);
    fetchTokenData();

    return () => {
      mounted = false;
    };
  }, [tokenIdentifier, handleError, contractAddress, tokenId]);

  useEffect(() => {
    if (textRef.current) {
      const lineHeight = parseInt(
        window.getComputedStyle(textRef.current).lineHeight
      );
      const height = textRef.current.offsetHeight;
      setIsTextTruncated(height > lineHeight * 4);
    }
  }, [tokenData?.description]);

  // Get total minted from events
  useEffect(() => {
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

        setTotalMinted(total);
      } catch (err) {
        console.error("Error fetching mint events:", err);
      }
    };

    fetchTotalMinted();
  }, [tokenId, contractAddress]);

  if (loading)
    return (
      <div className="bg-white group flex flex-col items-center justify-center min-h-60">
        <div className="p-3 text-center text-[12px] font-light opacity-60">
          Loading token data...
        </div>
      </div>
    );
  if (error)
    return (
      <div className="bg-white group flex flex-col items-center justify-center min-h-60">
        <div className="p-3 text-center text-[12px] font-light opacity-60">
          Error loading token: {error}
        </div>
      </div>
    );
  if (!tokenData) return null;

  const now = Math.floor(Date.now() / 1000);
  const isMintActive = tokenData.mintOpenUntil > now;
  const closeDate = new Date(tokenData.mintOpenUntil * 1000);

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

    // if metatadata?.image is ipfs://, fetch the image from ipfs
    if (metadata?.image && metadata?.image.includes("ipfs://")) {
      return (
        <img
          src={`https://ipfs.io/ipfs/${metadata.image.slice(7)}`}
          alt={tokenData.name}
          className="w-full"
        />
      );
    }

    if (metadata?.image) {
      return (
        <img src={metadata.image} alt={tokenData.name} className="w-full" />
      );
    }

    return null;
  };

  const displayContent = getDisplayContent(metadata, tokenData);

  return (
    <Link
      href={`/token/${contractAddress}/${tokenId}`}
      // href={`https://networked.art//${deployerAddress}/${contractAddress}/${tokenId}`}
      className="bg-white group hover:shadow-xl relative hover:-mt-1 hover:pb-1 transition-all duration-150 ease-in-out flex flex-col"
    >
      <div className="p-3">
        <h3 className="text-sm font-bold opacity-75">{tokenData.name}</h3>
        <p className="text-[14px] opacity-60 font-thin">
          <DisplayName address={deployerAddress} />
        </p>
      </div>
      <div className="w-full aspect-square">{displayContent}</div>
      <div className="p-4">
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

        {tokenData.description && (
          <>
            <hr className="my-2" />
            <div className="relative">
              <p
                ref={textRef}
                className="text-[12px] font-thin opacity-75 mt-2 line-clamp-3"
              >
                {tokenData.description}
              </p>
              {isTextTruncated && (
                <div className="absolute bottom-0 left-0 w-full h-8 bg-gradient-to-t from-white to-transparent" />
              )}
            </div>
          </>
        )}
      </div>
    </Link>
  );
};
