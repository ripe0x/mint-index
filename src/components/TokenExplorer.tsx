import React, { useEffect, useState } from "react";
import { fetchFactoryEvents } from "@/lib/fetchFactoryEvents";
import { Address } from "viem";
import { Token } from "./Token";
import { client } from "@/config";
import { abi1155 } from "@/abi/abi1155";
import { useErrorHandler } from "@/app/utils/errors";

type TokenInfo = {
  contractAddress: Address;
  deployerAddress: Address;
  tokenId: number;
  mintedBlock: number;
  name: string;
};

const TokenExplorer = () => {
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const { error, handleError } = useErrorHandler();

  useEffect(() => {
    async function getAllTokens() {
      try {
        setLoading(true);
        // First get all contracts
        const results = await fetchFactoryEvents();
        const contracts = results.createdEvents.map((log) => ({
          owner: log.args.ownerAddress,
          contractAddress: log.args.contractAddress,
        }));

        // For each contract, fetch all its tokens
        const allTokenPromises = contracts.map(async (contract) => {
          try {
            if (!contract.contractAddress) {
              throw new Error("Contract address is undefined");
            }
            const latestTokenId = await client.readContract({
              address: contract.contractAddress as `0x${string}`,
              abi: abi1155,
              functionName: "latestTokenId",
            });

            // Create array of token IDs for this contract
            const tokenIds = Array.from(
              { length: Number(latestTokenId) },
              (_, i) => i + 1
            );

            // Fetch details for each token
            const tokenPromises = tokenIds.map(async (tokenId) => {
              try {
                const details = await client.readContract({
                  address: contract.contractAddress as `0x${string}`,
                  abi: abi1155,
                  functionName: "get",
                  args: [BigInt(tokenId)],
                });

                return {
                  contractAddress: contract.contractAddress,
                  deployerAddress: contract.owner,
                  tokenId,
                  mintedBlock: Number(details[4]),
                  name: details[0],
                };
              } catch (err) {
                console.error(
                  `Error fetching token ${tokenId} from ${contract.contractAddress}:`,
                  err
                );
                return null;
              }
            });

            const tokens = await Promise.all(tokenPromises);
            return tokens.filter((token): token is TokenInfo => token !== null);
          } catch (err) {
            console.error(
              `Error with contract ${contract.contractAddress}:`,
              err
            );
            return [];
          }
        });

        const tokenArrays = await Promise.all(allTokenPromises);
        const allTokens = tokenArrays.flat();

        // Sort tokens by minted block (descending)
        const sortedTokens = allTokens.sort(
          (a, b) => b.mintedBlock - a.mintedBlock
        );

        setTokens(sortedTokens);
        setLoading(false);
      } catch (err) {
        handleError(err);
      }
    }

    getAllTokens();
  }, [handleError]);

  if (loading)
    return (
      <div className="px-4 lg:px-8 xl:px-12 py-4 text-gray-600">
        Loading all tokens...
      </div>
    );
  if (error)
    return (
      <div className="px-4 lg:px-8 xl:px-12 py-4 text-gray-600">
        Error: {error}
      </div>
    );

  return (
    <div className="px-4 lg:px-8 xl:px-12 py-2">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4 lg:gap-8 xl:gap-16">
        {tokens.map((token) => (
          <div
            key={`${token.contractAddress}-${token.tokenId}`}
            className="mb-8"
          >
            <Token
              contractAddress={token.contractAddress}
              tokenId={token.tokenId}
              deployerAddress={token.deployerAddress}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default TokenExplorer;
