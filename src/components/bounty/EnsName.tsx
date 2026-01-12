import React from "react";
import { useEnsName } from "wagmi";
import { Address } from "viem";
import { shortenAddress } from "@/lib/bountyHelpers";
import { mainnet } from "viem/chains";

interface EnsNameProps {
  address: Address;
  className?: string;
  showFullAddress?: boolean;
  cachedName?: string | null; // Pre-resolved ENS name from API
}

export const EnsName: React.FC<EnsNameProps> = ({
  address,
  className = "",
  showFullAddress = false,
  cachedName,
}) => {
  // Skip RPC call if we have a cached name
  const { data: ensName } = useEnsName({
    address,
    chainId: mainnet.id,
    query: {
      enabled: !cachedName, // Only fetch if no cached name
      staleTime: 60 * 60 * 1000, // 1 hour - ENS names rarely change
      gcTime: 24 * 60 * 60 * 1000, // 24 hours cache
    },
  });

  const displayName = cachedName || ensName;

  if (displayName) {
    return <span className={className}>{displayName}</span>;
  }

  return (
    <span className={`font-mono ${className}`}>
      {showFullAddress ? address : shortenAddress(address, 6)}
    </span>
  );
};