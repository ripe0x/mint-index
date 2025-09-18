import React, { useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { Address } from "viem";
import { abiMintBounty } from "@/abi/abiMintBounty";
import { abi1155 } from "@/abi/abi1155";
import {
  formatETH,
  getBountyStatusDisplay,
  shortenAddress,
  BountyStatus,
} from "@/lib/bountyHelpers";
import { TransactionStatus } from "./TransactionStatus";
import { EnsName } from "./EnsName";
import { BountyTokenImage } from "./BountyTokenImage";

interface BountyCardProps {
  bountyContract: Address;
  tokenContract: Address;
  isOwner?: boolean;
  onUpdate?: () => void;
}

export const BountyCard: React.FC<BountyCardProps> = ({
  bountyContract,
  tokenContract,
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
    abi: abiMintBounty,
    functionName: "bounties",
    args: [tokenContract],
  });

  // Check if claimable
  const { data: isClaimable } = useReadContract({
    address: bountyContract,
    abi: abiMintBounty,
    functionName: "isBountyClaimable",
    args: [tokenContract],
  });

  // Read owner
  const { data: owner } = useReadContract({
    address: bountyContract,
    abi: abiMintBounty,
    functionName: "owner",
  });

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
        abi: abiMintBounty,
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

  if (!bountyData) return null;

  const status = getBountyStatus();
  const statusDisplay = getBountyStatusDisplay(status);

  const ownerArtifacts = Number(bountyData[3]) - Number(bountyData[4]);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex gap-4">
        {/* Token Image */}
        <div className="flex-shrink-0">
          <BountyTokenImage
            tokenContract={tokenContract}
            lastMintedId={bountyData[2]} // lastMintedId from bounty data
          />
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-sm font-medium ${statusDisplay.color}`}>
                  {statusDisplay.emoji} {statusDisplay.text}
                </span>
                {isOwner && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                    Your Contract
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Owner:</span>
                <span className="text-xs font-medium">
                  {owner === address ? (
                    "You"
                  ) : (
                    <EnsName address={owner || "0x0"} />
                  )}
                </span>
              </div>
            </div>
            <a
              href={`https://etherscan.io/address/${bountyContract}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline"
            >
              Etherscan →
            </a>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Token:</span>
              <span className="font-mono text-xs">
                {shortenAddress(tokenContract, 6)}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Recipient:</span>
              <span className="text-xs">
                {bountyData[0] === address ? (
                  "You"
                ) : (
                  <EnsName address={bountyData[0]} />
                )}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Artifacts:</span>
              <span>
                {bountyData[3].toString()} total ({ownerArtifacts} owner,{" "}
                {bountyData[4].toString()} claimer)
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Max Price:</span>
              <span>{formatETH(bountyData[5])} ETH</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Balance:</span>
              <span className="font-medium">
                {formatETH(bountyData[6])} ETH
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Next Token ID:</span>
              <span>
                #
                {bountyData[2] === BigInt(0)
                  ? latestTokenId
                    ? latestTokenId.toString()
                    : "Loading..."
                  : (bountyData[2] + BigInt(1)).toString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {status === "claimable" && !isOwner && (
        <>
          {!isConnected ? (
            <div className="w-full mt-4 py-2 px-4 rounded bg-gray-100 text-gray-600 text-sm text-center">
              Connect wallet to claim {bountyData[4].toString()} NFT
              {bountyData[4] === BigInt(1) ? "" : "s"}
            </div>
          ) : (
            <button
              onClick={handleClaim}
              disabled={isWritePending || isReceiptLoading}
              className={`w-full mt-4 py-2 px-4 rounded font-medium text-sm transition-colors ${
                isWritePending || isReceiptLoading
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-green-600 text-white hover:bg-green-700"
              }`}
            >
              {isWritePending
                ? "Confirm in wallet..."
                : isReceiptLoading
                ? "Claiming..."
                : `Claim ${bountyData[4].toString()} NFT${
                    bountyData[4] === BigInt(1) ? "" : "s"
                  }`}
            </button>
          )}
        </>
      )}

      <TransactionStatus
        status={txStatus}
        hash={hash}
        error={writeError?.message}
        successMessage="Bounty claimed successfully!"
      />
    </div>
  );
};
