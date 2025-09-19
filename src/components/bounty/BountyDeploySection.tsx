import React, { useState } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { abiBountyFactory } from "@/abi/abiBountyFactory";
import { FACTORY_ADDRESS } from "@/lib/bountyHelpers";
import { TransactionStatus } from "./TransactionStatus";
import { Address } from "viem";

interface BountyDeploySectionProps {
  onDeploySuccess?: (contractAddress: Address) => void;
}

export const BountyDeploySection: React.FC<BountyDeploySectionProps> = ({
  onDeploySuccess,
}) => {
  const { isConnected } = useAccount();
  const [txStatus, setTxStatus] = useState<
    "idle" | "confirming" | "processing" | "success" | "error"
  >("idle");

  const {
    writeContract,
    data: hash,
    error: writeError,
    isPending: isWritePending,
  } = useWriteContract();

  const { data: receipt, isLoading: isReceiptLoading } =
    useWaitForTransactionReceipt({
      hash,
    });

  const handleDeploy = async () => {
    try {
      setTxStatus("confirming");

      await writeContract({
        address: FACTORY_ADDRESS,
        abi: abiBountyFactory,
        functionName: "deployBountyContract",
      });

      setTxStatus("processing");
    } catch (error) {
      console.error("Deploy error:", error);
      setTxStatus("error");
    }
  };

  React.useEffect(() => {
    if (receipt?.status === "success") {
      setTxStatus("success");

      // Extract deployed contract address from logs
      const deployedEvent = receipt.logs.find(
        (log) => log.address.toLowerCase() === FACTORY_ADDRESS.toLowerCase()
      );

      if (deployedEvent && onDeploySuccess) {
        // The contract address is in the event data
        const contractAddress = `0x${deployedEvent.data.slice(
          26,
          66
        )}` as Address;
        onDeploySuccess(contractAddress);
      }
    } else if (receipt?.status === "reverted") {
      setTxStatus("error");
    }
  }, [receipt, onDeploySuccess]);

  React.useEffect(() => {
    if (writeError) {
      setTxStatus("error");
    }
  }, [writeError]);

  if (!isConnected) {
    return (
      <div className="bg-gray-100 border border-gray-300 rounded-lg p-8 text-center">
        <h2 className="text-xl font-bold mb-4">Deploy Your Bounty Contract</h2>
        <p className="text-gray-600 mb-4">
          Connect your wallet to deploy a MintBounty contract
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="space-y-3 mb-6">
        <p className="text-sm text-gray-600">
          Deploy your own MintBounty contract for ~67k gas ($9 at 30 gwei)
        </p>
        <ul className="text-sm text-gray-600 list-disc list-inside">
          <li>Create and manage multiple bounties</li>
          <li>Set custom rewards and parameters</li>
          <li>Fund and withdraw ETH</li>
          <li>Full control over your bounty contracts</li>
        </ul>
      </div>

      <button
        onClick={handleDeploy}
        disabled={
          isWritePending || isReceiptLoading || txStatus === "processing"
        }
        className={`w-full py-3 px-4 rounded font-medium transition-colors ${
          isWritePending || isReceiptLoading || txStatus === "processing"
            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
            : "bg-black text-white hover:bg-gray-800"
        }`}
      >
        {isWritePending || txStatus === "confirming"
          ? "Confirm in wallet..."
          : isReceiptLoading || txStatus === "processing"
          ? "Deploying..."
          : "Deploy Bounty Contract"}
      </button>

      <TransactionStatus
        status={txStatus}
        hash={hash}
        error={writeError?.message}
        successMessage={
          receipt?.status === "success"
            ? `Contract deployed successfully!`
            : undefined
        }
      />
    </div>
  );
};
