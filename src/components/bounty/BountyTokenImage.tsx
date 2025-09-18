import React, { useEffect, useState } from "react";
import { useReadContract } from "wagmi";
import { Address } from "viem";
import { abi1155 } from "@/abi/abi1155";

interface BountyTokenImageProps {
  tokenContract: Address;
  lastMintedId: bigint;
  contractMetadata?: {
    name?: string;
    image?: string;
    [key: string]: unknown;
  } | null;
  className?: string;
}

export const BountyTokenImage: React.FC<BountyTokenImageProps> = ({
  tokenContract,
  lastMintedId,
  contractMetadata,
  className = "w-16 h-16 rounded object-cover",
}) => {
  const [imageUrl, setImageUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Determine the token ID to display
  // If lastMintedId > 0, show the next token (lastMintedId + 1)
  // If lastMintedId == 0, show the latest token (which will be minted)
  const shouldFetchLatest = lastMintedId === 0n;

  // Get latest token ID if needed
  const { data: latestTokenId } = useReadContract(
    shouldFetchLatest
      ? {
          address: tokenContract,
          abi: abi1155,
          functionName: "latestTokenId",
        }
      : undefined
  );

  // The actual token ID to use for fetching metadata
  // When lastMintedId is 0, show the latest token (bounty will mint copies of it)
  // When lastMintedId > 0, show the next token that will be minted
  const tokenIdToUse = shouldFetchLatest
    ? (latestTokenId as bigint || 0n)
    : lastMintedId + 1n;

  // Fetch token URI
  const { data: tokenUri } = useReadContract(
    tokenIdToUse > 0n
      ? {
          address: tokenContract,
          abi: abi1155,
          functionName: "uri",
          args: [tokenIdToUse],
        }
      : undefined
  );


  // Fetch and process token metadata
  useEffect(() => {
    async function fetchMetadata() {
      if (!tokenUri || tokenIdToUse === 0n) {
        setLoading(false);
        setImageUrl("");
        return;
      }

      try {
        // Fetch metadata from tokenUri
        const response = await fetch(tokenUri as string);
        const metadata = await response.json();

        if (metadata.image) {
          let imageUri = metadata.image;
          // Handle IPFS URIs
          if (imageUri.startsWith("ipfs://")) {
            imageUri = `https://ipfs.io/ipfs/${imageUri.slice(7)}`;
          }
          setImageUrl(imageUri);
        } else {
          setImageUrl("");
        }
      } catch (error) {
        console.error("Error fetching token metadata:", error);
        setImageUrl("");
      } finally {
        setLoading(false);
      }
    }

    fetchMetadata();
  }, [tokenUri, tokenIdToUse]);

  if (loading) {
    return (
      <div className={`bg-gray-200 animate-pulse ${className}`}></div>
    );
  }

  // Determine which image to show
  const displayImage = imageUrl || contractMetadata?.image;

  // Process IPFS URLs if needed
  const processImageUrl = (url: string) => {
    if (url?.startsWith("ipfs://")) {
      return `https://ipfs.io/ipfs/${url.slice(7)}`;
    }
    return url;
  };

  // Show placeholder if no token ID and no images available
  if (tokenIdToUse === 0n && !displayImage) {
    return (
      <div className={`bg-gray-100 flex items-center justify-center ${className}`}>
        <span className="text-[10px] text-gray-400 text-center">
          No token yet
        </span>
      </div>
    );
  }

  // Show image (either token image or contract image as fallback)
  if (displayImage) {
    return (
      <img
        src={processImageUrl(displayImage)}
        alt={imageUrl ? `Token #${tokenIdToUse}` : "Contract"}
        className={className}
        onError={(e) => {
          e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' fill='%23ddd'%3E%3Crect width='64' height='64' /%3E%3C/svg%3E";
        }}
      />
    );
  }

  // Fallback placeholder
  return (
    <div className={`bg-gray-100 flex items-center justify-center ${className}`}>
      <span className="text-[10px] text-gray-400 text-center">
        No image
      </span>
    </div>
  );
};