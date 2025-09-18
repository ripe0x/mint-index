import React, { useEffect, useState } from "react";
import { useReadContract } from "wagmi";
import { Address } from "viem";
import { abi1155 } from "@/abi/abi1155";

interface BountyTokenImageProps {
  tokenContract: Address;
  lastMintedId: bigint;
}

export const BountyTokenImage: React.FC<BountyTokenImageProps> = ({
  tokenContract,
  lastMintedId,
}) => {
  const [tokenId, setTokenId] = useState<bigint>(0n);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Get latest token ID if lastMintedId is 0
  const { data: latestTokenId } = useReadContract(
    lastMintedId === 0n
      ? {
          address: tokenContract,
          abi: abi1155,
          functionName: "latestTokenId",
        }
      : undefined
  );

  // Determine which token ID to use
  useEffect(() => {
    if (lastMintedId === 0n && latestTokenId) {
      setTokenId(latestTokenId as bigint);
    } else if (lastMintedId > 0n) {
      // Next token to mint is lastMintedId + 1
      setTokenId(lastMintedId + 1n);
    }
  }, [lastMintedId, latestTokenId]);

  // Fetch token URI
  const { data: tokenUri } = useReadContract(
    tokenId > 0n
      ? {
          address: tokenContract,
          abi: abi1155,
          functionName: "uri",
          args: [tokenId],
        }
      : undefined
  );

  // Fetch and process token metadata
  useEffect(() => {
    async function fetchMetadata() {
      if (!tokenUri) {
        setLoading(false);
        return;
      }

      try {
        // Handle IPFS URIs
        let metadataUrl = tokenUri as string;
        if (metadataUrl.startsWith("ipfs://")) {
          metadataUrl = metadataUrl.replace("ipfs://", "https://ipfs.io/ipfs/");
        }

        // Handle on-chain base64 encoded data
        if (metadataUrl.startsWith("data:application/json;base64,")) {
          const base64Data = metadataUrl.split(",")[1];
          const jsonString = atob(base64Data);
          const metadata = JSON.parse(jsonString);

          if (metadata.image) {
            let imageUri = metadata.image;
            if (imageUri.startsWith("ipfs://")) {
              imageUri = imageUri.replace("ipfs://", "https://ipfs.io/ipfs/");
            }
            setImageUrl(imageUri);
          }
        } else {
          // Fetch external metadata
          const response = await fetch(metadataUrl);
          const metadata = await response.json();

          if (metadata.image) {
            let imageUri = metadata.image;
            if (imageUri.startsWith("ipfs://")) {
              imageUri = imageUri.replace("ipfs://", "https://ipfs.io/ipfs/");
            }
            setImageUrl(imageUri);
          }
        }
      } catch (error) {
        console.error("Error fetching token metadata:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchMetadata();
  }, [tokenUri]);

  if (loading) {
    return (
      <div className="w-16 h-16 bg-gray-200 rounded animate-pulse"></div>
    );
  }

  if (!imageUrl) {
    return (
      <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center">
        <span className="text-xs text-gray-400">No image</span>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={`Token #${tokenId}`}
      className="w-16 h-16 object-cover rounded"
      onError={(e) => {
        e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' fill='%23ddd'%3E%3Crect width='64' height='64' /%3E%3C/svg%3E";
      }}
    />
  );
};