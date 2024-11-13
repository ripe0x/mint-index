import { useState, useEffect, useMemo } from "react";
import { Address } from "viem";
import { Token } from "./Token";
import { abi1155 } from "@/abi/abi1155";
import { client } from "@/config";
import DisplayName from "./DisplayName";
import { useErrorHandler } from "@/app/utils/errors";

type Props = {
  contractAddress: Address;
  deployerAddress: Address;
};
// Contract Component

export const Contract = ({ contractAddress, deployerAddress }: Props) => {
  const [tokenIds, setTokenIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const { error, handleError } = useErrorHandler();

  // Memoize the contract address to prevent unnecessary re-fetches
  const memoizedAddress = useMemo(() => contractAddress, [contractAddress]);

  useEffect(() => {
    let mounted = true;

    async function fetchContractTokens() {
      try {
        const latestTokenId = await client.readContract({
          address: memoizedAddress,
          abi: abi1155,
          functionName: "latestTokenId",
        });

        if (mounted) {
          setTokenIds(
            Array.from({ length: Number(latestTokenId) }, (_, i) => i + 1)
          );
          setLoading(false);
        }
      } catch (err) {
        handleError(err);
      }
    }

    fetchContractTokens();

    return () => {
      mounted = false;
    };
  }, [memoizedAddress, handleError]);

  if (loading) return <div>Loading contract data...</div>;
  if (error) return <div>Error loading contract: {error}</div>;
  // if (tokenIds.length === 0)
  //   return <div>No tokens found for this contract</div>;

  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold">
        Contract: <DisplayName address={contractAddress} />
        <span className="text-sm font-normal ml-2">
          ({tokenIds.length} tokens)
        </span>
      </h2>
      <p>
        Deployed by: <DisplayName address={deployerAddress} />
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tokenIds.length === 0 ? (
          <p className="text-gray-300">No tokens found for this contract</p>
        ) : (
          tokenIds.map((tokenId) => (
            <Token
              key={`${contractAddress}-${tokenId}`}
              contractAddress={contractAddress}
              deployerAddress={deployerAddress}
              tokenId={tokenId}
            />
          ))
        )}
      </div>
      <hr className="h-px my-8 bg-gray-200 border-0 dark:bg-gray-700" />
    </div>
  );
};
