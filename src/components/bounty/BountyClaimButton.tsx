import React, { useState } from "react";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { Address } from "viem";
import { abiMintBountyNew } from "@/abi/abiMintBountyNew";

interface BountyClaimButtonProps {
  bountyContract: Address;
  tokenContract: Address;
  gasRefundAmount: bigint;
  isActive: boolean;
  balance: bigint;
  claimedCount: number;
  maxClaims: number;
  disabled?: boolean;
  compact?: boolean;
}

export const BountyClaimButton: React.FC<BountyClaimButtonProps> = ({
  bountyContract,
  tokenContract,
  gasRefundAmount,
  isActive,
  balance,
  claimedCount,
  maxClaims,
  disabled = false,
  compact = false,
}) => {
  const [txStatus, setTxStatus] = useState<
    "idle" | "confirming" | "processing" | "success" | "error"
  >("idle");

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

  // Check if claimable - need to check if balance covers both minting cost and gas refund
  // The actual minting cost would need to be fetched from the contract, but we can estimate
  // For now, check if balance is sufficient for at least the gas refund amount
  const isClaimable = isActive &&
    balance > 0n &&
    balance >= gasRefundAmount &&
    (maxClaims === 0 || claimedCount < maxClaims);

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
      // Refresh the page to update bounty status
      setTimeout(() => window.location.reload(), 2000);
    }
  }, [isSuccess]);

  React.useEffect(() => {
    if (writeError) {
      setTxStatus("error");
    }
  }, [writeError]);

  const buttonText = () => {
    if (disabled) return "Connect Wallet";
    if (isWritePending) return "Confirm...";
    if (isReceiptLoading) return "Minting...";
    if (txStatus === "success") return "Success!";
    if (!isClaimable || !isActive) {
      return "Claim Inactive";
    }
    return "Mint & Claim";
  };

  const buttonClasses = () => {
    const base = compact
      ? "px-3 py-1 text-[11px] rounded font-medium transition-colors"
      : "py-2 px-4 rounded font-medium text-sm transition-colors";

    if (disabled || !isClaimable || !isActive || isWritePending || isReceiptLoading) {
      return `${base} bg-gray-200 text-gray-500 cursor-not-allowed`;
    }

    if (txStatus === "success") {
      return `${base} bg-green-100 text-green-700`;
    }

    if (txStatus === "error") {
      return `${base} bg-red-100 text-red-700`;
    }

    return `${base} bg-black text-white hover:bg-gray-800`;
  };

  return (
    <>
      <button
        onClick={handleClaim}
        disabled={disabled || !isClaimable || !isActive || isWritePending || isReceiptLoading}
        className={buttonClasses()}
      >
        {buttonText()}
      </button>

      {txStatus === "error" && writeError && (
        <div className="text-[10px] text-red-600 mt-1">
          {writeError.message.split('\n')[0]}
        </div>
      )}

      {txStatus === "success" && hash && (
        <div className="text-[10px] text-green-600 mt-1">
          <a
            href={`https://etherscan.io/tx/${hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            View transaction →
          </a>
        </div>
      )}
    </>
  );
};