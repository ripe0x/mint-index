import React, { useState, useEffect } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { Address } from "viem";
import { abiMintBountyNew } from "@/abi/abiMintBountyNew";
import { abi1155 } from "@/abi/abi1155";
import {
  formatETH,
  shortenAddress,
  BountyStatus,
} from "@/lib/bountyHelpers";
import { TransactionStatus } from "./TransactionStatus";
import { EnsName } from "./EnsName";
import { BountyTokenImage } from "./BountyTokenImage";

interface BountyCardProps {
  bountyContract: Address;
  tokenContract?: Address;
  isOwner?: boolean;
  onUpdate?: () => void;
}

const DEFAULT_TOKEN_CONTRACT =
  "0xBA1901b542Aa58f181F7ae18eD6Cd79FdA779C62" as Address;

export const BountyCard: React.FC<BountyCardProps> = ({
  bountyContract,
  tokenContract = DEFAULT_TOKEN_CONTRACT,
  isOwner,
  onUpdate,
}) => {
  const { address, isConnected } = useAccount();
  const [txStatus, setTxStatus] = useState<
    "idle" | "confirming" | "processing" | "success" | "error"
  >("idle");

  // Read bounty details
  const { data: bountyData } = useReadContract({
    address: bountyContract,
    abi: abiMintBountyNew,
    functionName: "bounties",
    args: [tokenContract],
  });

  // Check if claimable
  const { data: isClaimable } = useReadContract({
    address: bountyContract,
    abi: abiMintBountyNew,
    functionName: "isBountyClaimable",
    args: [tokenContract],
  });

  // Read bounty contract owner
  const { data: owner } = useReadContract({
    address: bountyContract,
    abi: abiMintBountyNew,
    functionName: "owner",
  });

  // Read contract URI for metadata
  const { data: contractUri } = useReadContract({
    address: tokenContract,
    abi: abi1155,
    functionName: "contractURI",
  });

  // Read token contract owner
  const { data: tokenOwner } = useReadContract({
    address: tokenContract,
    abi: abi1155,
    functionName: "owner",
  });

  // State for contract metadata
  const [contractMetadata, setContractMetadata] = useState<{
    name?: string;
    image?: string;
    [key: string]: unknown;
  } | null>(null);

  // Fetch contract metadata
  useEffect(() => {
    async function fetchContractMetadata() {
      if (!contractUri) return;

      try {
        const response = await fetch(contractUri as string);
        const metadata = await response.json();
        setContractMetadata(metadata);
      } catch (error) {
        console.error("Error fetching contract metadata:", error);
      }
    }

    fetchContractMetadata();
  }, [contractUri]);

  // Get latest token ID if lastMintedId is 0
  const { data: latestTokenId } = useReadContract(
    bountyData?.[2] === BigInt(0)
      ? {
          address: tokenContract,
          abi: abi1155,
          functionName: "latestTokenId",
        }
      : undefined
  );

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
    if (!bountyData) return "not_available";
    if (bountyData[1]) return "paused"; // paused
    if (isClaimable) return "claimable";
    if (bountyData[6] === BigInt(0)) return "insufficient_balance"; // balance
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

  React.useEffect(() => {
    if (isSuccess) {
      setTxStatus("success");
      onUpdate?.();
    }
  }, [isSuccess, onUpdate]);

  React.useEffect(() => {
    if (writeError) {
      setTxStatus("error");
    }
  }, [writeError]);

  const lastMintedId = bountyData?.[2] || BigInt(0); // lastMintedId

  // Determine which token will be minted
  // When lastMintedId is 0, it will mint copies of the latest token
  // When lastMintedId > 0, it will mint lastMintedId + 1
  const tokenToMint =
    lastMintedId === BigInt(0)
      ? latestTokenId
        ? (latestTokenId as bigint)
        : BigInt(1)
      : lastMintedId + BigInt(1);

  if (!bountyData) return null;

  const status = getBountyStatus();

  const artifactsToMint = Number(bountyData?.[3] || 0); // artifactsToMint (total tokens)
  const minterReward = Number(bountyData?.[4] || 0); // minterReward (tokens for claimer)
  const balance = bountyData?.[6] || BigInt(0); // balance

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow relative">
      {/* Etherscan link positioned absolutely on desktop only */}
      <a
        href={`https://etherscan.io/address/${bountyContract}`}
        target="_blank"
        rel="noopener noreferrer"
        className="hidden sm:block absolute top-4 right-4 text-xs text-blue-600 hover:underline"
      >
        View on Etherscan →
      </a>

      <div className="flex gap-4">
        {/* Token Image - hidden on mobile */}
        <div className="flex-shrink-0 hidden sm:block">
          <BountyTokenImage
            tokenContract={tokenContract}
            lastMintedId={lastMintedId || BigInt(0)}
            contractMetadata={contractMetadata}
          />
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="mb-3">
            {/* Title: Bounty reward */}

            <div className="mb-1 text-[16px] leading-snug">
              {artifactsToMint}{" "}
              <a
                href={`https://networked.art/${tokenOwner}/${tokenContract.toLowerCase()}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {contractMetadata?.name || "Token"}
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

            {/* Owner */}
            <div className="text-[12px] text-gray-600 mb-0">
              Bounty reward: {minterReward} token
              {(minterReward || 1) === 1 ? "" : "s"}{" "}
              {/* {owner === address ? "You" : <EnsName address={owner || "0x0"} />}
              {isOwner && (
                <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                  Your Contract
                </span>
              )} */}
            </div>

            <div className="text-[12px] text-gray-600 mb-2">
              Set by{" "}
              {owner === address ? "You" : <EnsName address={owner || "0x0"} />}
              {/* {isOwner && (
                <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                  Your Contract
                </span>
              )} */}
            </div>

            {/* Token contract info */}
            {/* <div className="text-xs text-gray-600">
              On{" "}
              <a
                href={`https://networked.art/${tokenContract.toLowerCase()}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {contractMetadata?.name || "Token"}
              </a>{" "}
              by{" "}
              {tokenOwner ? (
                <EnsName address={tokenOwner} />
              ) : (
                <span className="font-mono text-xs">
                  {shortenAddress(tokenContract, 4)}
                </span>
              )}
            </div> */}

            {/* Status badge */}
            {/* <div className="flex items-center gap-2 mt-2">
              <span className={`text-sm font-medium ${statusDisplay.color}`}>
                {statusDisplay.emoji} {statusDisplay.text}
              </span>
            </div> */}
          </div>

          {/* Secondary details - smaller and less prominent */}
          <div className="space-y-0.5 text-[11px] text-gray-500 border-t pt-2 mt-2">
            <div className="flex gap-4 md:flex-row flex-col">
              {/* <span className="text-gray-400">
                Tokens to mint: {artifactsToMint}
              </span> */}
              <span className="text-gray-400">
                Bounty balance: {formatETH(balance)} ETH
              </span>
            </div>
            <div className="text-gray-400">
              Token #{tokenToMint.toString()} •{" "}
              {shortenAddress(tokenContract, 6)}
            </div>
          </div>
        </div>

        {/* Button column - hidden on mobile, shown on desktop */}
        <div className="flex-shrink-0 items-center hidden sm:flex">
          {!isConnected ? (
            <div className="py-2 px-4 rounded bg-gray-100 text-gray-600 text-sm text-center">
              Connect wallet
            </div>
          ) : status === "claimable" && !isOwner ? (
            <button
              onClick={handleClaim}
              disabled={isWritePending || isReceiptLoading}
              className={`py-2 px-4 rounded font-medium text-sm transition-colors ${
                isWritePending || isReceiptLoading
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
              Claim Inactive
            </button>
          )}
        </div>
      </div>

      {/* Button row for mobile - shown below content */}
      <div className="sm:hidden mt-3 pt-3 border-t">
        {!isConnected ? (
          <button
            className="w-full py-2 px-4 rounded bg-gray-100 text-gray-600 text-sm text-center"
            disabled
          >
            Connect wallet
          </button>
        ) : status === "claimable" && !isOwner ? (
          <button
            onClick={handleClaim}
            disabled={isWritePending || isReceiptLoading}
            className={`w-full py-2 px-4 rounded font-medium text-sm transition-colors ${
              isWritePending || isReceiptLoading
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
            Bounty Claimed
          </button>
        )}
        <a
          href={`https://etherscan.io/address/${bountyContract}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-[11px] text-blue-600 hover:underline text-center mt-2"
        >
          View on Etherscan →
        </a>
      </div>

      <TransactionStatus
        status={txStatus}
        hash={hash}
        error={writeError?.message}
        successMessage="Bounty claimed successfully!"
      />
    </div>
  );
};
