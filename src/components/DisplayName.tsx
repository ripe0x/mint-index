import React from "react";
import { Address } from "viem";
import { useEnsName } from "wagmi";

type Props = {
  address?: Address;
  cachedName?: string | null;
};

const DisplayName = (props: Props) => {
  // Skip RPC call if we have a cached name
  const result = useEnsName({
    address: props.address,
    query: {
      enabled: props.cachedName === undefined, // Only fetch if no cached name provided
      staleTime: 60 * 60 * 1000, // 1 hour
    },
  });

  const concatAddr = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Use cached name if provided
  if (props.cachedName !== undefined) {
    return (
      <span>
        {props.cachedName || (props.address ? concatAddr(props.address) : "")}
      </span>
    );
  }

  return (
    <>
      {props.address && (
        <>
          {result.isLoading ? (
            <span>{concatAddr(props.address)}</span>
          ) : result.error ? (
            <span>{concatAddr(props.address)}</span>
          ) : result.data ? (
            <span>{result.data}</span>
          ) : (
            <span>{concatAddr(props.address)}</span>
          )}
        </>
      )}
    </>
  );
};

export default DisplayName;
