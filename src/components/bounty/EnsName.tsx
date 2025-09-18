import React from "react";
import { useEnsName } from "wagmi";
import { Address } from "viem";
import { shortenAddress } from "@/lib/bountyHelpers";
import { mainnet } from "viem/chains";

interface EnsNameProps {
  address: Address;
  className?: string;
  showFullAddress?: boolean;
}

export const EnsName: React.FC<EnsNameProps> = ({
  address,
  className = "",
  showFullAddress = false,
}) => {
  const { data: ensName } = useEnsName({
    address,
    chainId: mainnet.id,
  });

  if (ensName) {
    return <span className={className}>{ensName}</span>;
  }

  return (
    <span className={`font-mono ${className}`}>
      {showFullAddress ? address : shortenAddress(address, 6)}
    </span>
  );
};