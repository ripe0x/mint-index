import React, { useState, useEffect } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
// Address type imported via BountyData
import { abiMintBountyNew } from "@/abi/abiMintBountyNew";
import { abi1155 } from "@/abi/abi1155";
import { formatETH, shortenAddress, BountyStatus } from "@/lib/bountyHelpers";
import { TransactionStatus } from "./TransactionStatus";
import { EnsName } from "./EnsName";
import { BountyTokenImage } from "./BountyTokenImage";
import { BountyManagement } from "./BountyManagement";
import { BountyData } from "@/types/bounty";

interface BountyCardProps {
  bountyData: BountyData;
  isOwner?: boolean;
  onUpdate?: () => void;
}

export const BountyCard: React.FC<BountyCardProps> = ({
  bountyData,
  isOwner,
  onUpdate,
}) => {
  const { address, isConnected } = useAccount();
  const queryClient = useQueryClient();
  const [txStatus, setTxStatus] = useState<
    "idle" | "confirming" | "processing" | "success" | "error"
  >("idle");
  const [showManagement, setShowManagement] = useState(false);

  // Extract data from prop (no RPC calls needed for these)
  const {
    bountyContract,
    tokenContract,
    lastMintedId,
    maxClaims: artifactsToMint,
    gasRefundAmount,
    balance,
    isActive,
    owner,
    tokenName,
    tokenOwner,
    contractUri,
    latestTokenId: latestTokenIdFromAPI,
    isClaimable: isClaimableFromAPI,
  } = bountyData;

  const minterReward = Number(gasRefundAmount);
  const lastMintedIdBigInt = BigInt(lastMintedId);

  // Determine which token will be minted
  const tokenToMint =
    lastMintedIdBigInt === BigInt(0)
      ? latestTokenIdFromAPI
        ? BigInt(latestTokenIdFromAPI)
        : BigInt(1)
      : lastMintedIdBigInt + BigInt(1);

  // Only RPC call we still need: user's token balance (requires connected address)
  const { data: userTokenBalance } = useReadContract(
    isConnected && address && latestTokenIdFromAPI
      ? {
          address: tokenContract,
          abi: abi1155,
          functionName: "balanceOf",
          args: [address, BigInt(latestTokenIdFromAPI)],
        }
      : undefined
  );

  // State for contract metadata (fetched from URI if not in API response)
  const [contractMetadata, setContractMetadata] = useState<{
    name?: string;
    image?: string;
    [key: string]: unknown;
  } | null>(tokenName ? { name: tokenName } : null);

  // Fetch contract metadata from URI if not already available
  useEffect(() => {
    async function fetchContractMetadata() {
      if (contractMetadata?.name || !contractUri) return;

      try {
        const response = await fetch(contractUri);
        const metadata = await response.json();
        setContractMetadata(metadata);
      } catch (error) {
        console.error("Error fetching contract metadata:", error);
      }
    }

    fetchContractMetadata();
  }, [contractUri, contractMetadata?.name]);

  const {
    writeContract,
    data: hash,
    error: writeError,
    isPending: isWritePending,
  } = useWriteContract();

  const { isLoading: isReceiptLoading, isSuccess } =
    useWaitForTransactionReceipt({
      hash,
    });

  // Determine bounty status
  const getBountyStatus = (): BountyStatus => {
    if (!isActive) return "paused";
    if (isClaimableFromAPI) return "claimable";
    if (balance === 0n) return "insufficient_balance";
    return "not_available";
  };

  const handleClaim = async () => {
    try {
      setTxStatus("confirming");

      await writeContract({
        address: bountyContract,
        abi: abiMintBountyNew,
        functionName: "claimBounty",
        args: [tokenContract],
      });

      setTxStatus("processing");
    } catch (error) {
      console.error("Claim error:", error);
      setTxStatus("error");
    }
  };

  // Handle successful claim with optimistic update
  useEffect(() => {
    if (isSuccess) {
      setTxStatus("success");

      // Optimistically update the local cache
      queryClient.setQueryData(["bounties"], (old: BountyData[] | undefined) => {
        if (!old) return old;
        return old.map((b) =>
          b.bountyContract === bountyContract && b.tokenContract === tokenContract
            ? { ...b, isClaimable: false, isActive: false }
            : b
        );
      });

      onUpdate?.();
    }
  }, [isSuccess, onUpdate, queryClient, bountyContract, tokenContract]);

  useEffect(() => {
    if (writeError) {
      setTxStatus("error");
    }
  }, [writeError]);

  const status = getBountyStatus();

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow relative">
      <div className="flex gap-4">
        {/* Token Image - hidden on mobile */}
        <div className="flex-shrink-0 hidden sm:block">
          <BountyTokenImage
            tokenContract={tokenContract}
            lastMintedId={lastMintedIdBigInt}
            contractMetadata={contractMetadata}
          />
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="mb-3">
            <div className="mb-1 text-[16px] leading-snug">
              {artifactsToMint}{" "}
              <a
                href={`https://networked.art/${tokenOwner}/${tokenContract.toLowerCase()}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {contractMetadata?.name || tokenName || "Token"}
              </a>{" "}
              by{" "}
              <a
                href={`https://networked.art/${tokenOwner}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {tokenOwner ? (
                  <EnsName address={tokenOwner} />
                ) : (
                  <span className="font-mono text-xs">
                    {shortenAddress(tokenContract, 4)}
                  </span>
                )}
              </a>
            </div>

            <div className="text-[12px] text-gray-600 mb-0">
              Bounty reward: {minterReward} token
              {minterReward === 1 ? "" : "s"}{" "}
            </div>

            <div className="text-[12px] text-gray-600 mb-2">
              Set by{" "}
              {owner === address ? "You" : <EnsName address={owner || "0x0"} />}
            </div>
          </div>

          {/* Secondary details */}
          <div className="space-y-0.5 text-[11px] text-gray-500 border-t pt-2 mt-2">
            <div className="flex gap-4 md:flex-row flex-col">
              <span className="text-gray-400">
                Bounty balance: {formatETH(balance)} ETH
              </span>
            </div>
            <div className="text-gray-400">
              Token #{latestTokenIdFromAPI?.toString() || tokenToMint.toString()} •{" "}
              {shortenAddress(tokenContract, 6)}
            </div>
          </div>
        </div>

        {/* Button column - hidden on mobile, shown on desktop */}
        <div className="flex-shrink-0 items-center hidden sm:flex">
          <div className="flex flex-col items-center gap-2">
            {status === "claimable" ? (
              <button
                onClick={isConnected ? handleClaim : undefined}
                disabled={!isConnected || isWritePending || isReceiptLoading}
                className={`py-2 px-4 rounded font-medium text-sm transition-colors ${
                  !isConnected
                    ? "bg-green-600 text-white cursor-not-allowed opacity-30"
                    : isWritePending || isReceiptLoading
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-green-600 text-white hover:bg-green-700"
                }`}
              >
                {isWritePending
                  ? "Confirm..."
                  : isReceiptLoading
                  ? "Minting..."
                  : "Mint & Claim"}
              </button>
            ) : (
              <button
                disabled
                className="py-2 px-4 rounded font-medium text-sm bg-gray-200 text-gray-500 cursor-not-allowed"
              >
                {isOwner
                  ? "Your Bounty"
                  : status === "paused"
                  ? "Paused"
                  : status === "insufficient_balance"
                  ? "No Balance"
                  : "Claimed"}
              </button>
            )}
            {isConnected && userTokenBalance !== undefined && userTokenBalance > 0n && (
              <span className="text-xs text-gray-400">
                You own {userTokenBalance.toString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Button row for mobile */}
      <div className="sm:hidden mt-3 pt-3 border-t">
        {status === "claimable" ? (
          <button
            onClick={isConnected ? handleClaim : undefined}
            disabled={!isConnected || isWritePending || isReceiptLoading}
            className={`w-full py-2 px-4 rounded font-medium text-sm transition-colors ${
              !isConnected
                ? "bg-green-600 text-white cursor-not-allowed opacity-30"
                : isWritePending || isReceiptLoading
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-green-600 text-white hover:bg-green-700"
            }`}
          >
            {isWritePending
              ? "Confirm..."
              : isReceiptLoading
              ? "Minting..."
              : "Mint & Claim"}
          </button>
        ) : (
          <button
            disabled
            className="w-full py-2 px-4 rounded font-medium text-sm bg-gray-200 text-gray-500 cursor-not-allowed"
          >
            {isOwner
              ? "Your Bounty"
              : status === "paused"
              ? "Paused"
              : status === "insufficient_balance"
              ? "No Balance"
              : "Claimed"}
          </button>
        )}
        {isConnected && userTokenBalance !== undefined && userTokenBalance > 0n && (
          <div className="text-xs text-gray-400 text-center mt-2">
            You own {userTokenBalance.toString()}
          </div>
        )}
      </div>

      <TransactionStatus
        status={txStatus}
        hash={hash}
        error={writeError?.message}
        successMessage="Bounty claimed successfully!"
      />

      {/* Management Section for Owners */}
      {isOwner && (
        <div className="mt-3 pt-3 border-t">
          <button
            onClick={() => setShowManagement(!showManagement)}
            className="text-sm text-blue-600 hover:underline"
          >
            {showManagement ? "Hide Management" : "Manage Bounty"}
          </button>
        </div>
      )}

      {/* Management Modal/Panel */}
      {showManagement && isOwner && (
        <div className="mt-4">
          <BountyManagement
            bountyContract={bountyContract}
            tokenContract={tokenContract}
            onUpdate={onUpdate}
          />
        </div>
      )}
    </div>
  );
};
