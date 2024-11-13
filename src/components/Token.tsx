import { abi1155 } from "@/abi/abi1155";
import { useState, useEffect, useMemo } from "react";
import { Address } from "viem";
import { client } from "@/config";
import { CountdownTimer } from "./CountdownTimer";
import type { TokenData, TokenMetadata } from "../types";
import { useErrorHandler } from "@/app/utils/errors";
import TokenMinter from "./TokenMinter";
import Image from "next/image";

type Props = {
  contractAddress: Address;
  tokenId: number;
};

export const Token = ({ contractAddress, tokenId }: Props) => {
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [metadata, setMetadata] = useState<TokenMetadata | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const { error, handleError } = useErrorHandler();

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
  }, [tokenIdentifier, handleError, contractAddress, tokenId]); // Only re-run if tokenIdentifier changes

  if (loading) return <div>Loading token data...</div>;
  if (error) return <div>Error loading token: {error}</div>;
  if (!tokenData) return null;

  const now = Math.floor(Date.now() / 1000);
  const isMintActive = tokenData.mintOpenUntil > now;
  const closeDate = new Date(tokenData.mintOpenUntil * 1000);

  return (
    <div className="rounded mb-4">
      <h3 className="font-bold text-lg">{tokenData.name}</h3>
      {metadata?.image && (
        <Image
          src={metadata.image}
          alt={tokenData.name}
          className="w-full h-48 object-cover rounded my-2"
        />
      )}
      <div className="text-sm space-y-1">
        <p>Token ID: {tokenId}</p>
        <p>Block Created: {tokenData.mintedBlock}</p>

        {isMintActive ? (
          <>
            <CountdownTimer closeAt={tokenData.mintOpenUntil} />
            <TokenMinter contractAddress={contractAddress} tokenId={tokenId} />
          </>
        ) : (
          <>
            <div className="space-y-1">
              <div className="text-red-500 font-medium">Mint Closed</div>
              <div className="text-sm text-gray-500">
                Closed on {closeDate.toLocaleString()}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
