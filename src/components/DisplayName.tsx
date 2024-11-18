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
  );
};

export default DisplayName;
