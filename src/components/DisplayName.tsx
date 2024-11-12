import React from "react";
import { Address } from "viem";
import { useEnsName } from "wagmi";

type Props = {
  address: Address;
};

const DisplayName = (props: Props) => {
  const result = useEnsName({
    address: props.address,
  });
  const concatAddr = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <>
      {/* link to etherscan address */}
      <a
        href={`https://etherscan.io/address/${props.address}`}
        target="_blank"
        rel="noreferrer"
      >
        {result.isLoading ? (
          <span>{concatAddr(props.address)}</span>
        ) : result.error ? (
          <span>Error: {result.error.message}</span>
        ) : result.data ? (
          <span>{result.data}</span>
        ) : (
          <span>{concatAddr(props.address)}</span>
        )}
      </a>
    </>
  );
};

export default DisplayName;
