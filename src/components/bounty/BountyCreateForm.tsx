import React, { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { Address, parseEther } from "viem";
import { abiMintBounty } from "@/abi/abiMintBounty";
import { DEFAULT_TOKEN_CONTRACT } from "@/lib/bountyHelpers";
import { TransactionStatus } from "./TransactionStatus";

interface BountyCreateFormProps {
  bountyContractAddress: Address;
  onSuccess?: () => void;
}

export const BountyCreateForm: React.FC<BountyCreateFormProps> = ({
  bountyContractAddress,
  onSuccess,
}) => {
  const { address } = useAccount();
  const [txStatus, setTxStatus] = useState<"idle" | "confirming" | "processing" | "success" | "error">("idle");

  const [formData, setFormData] = useState({
    tokenContract: DEFAULT_TOKEN_CONTRACT as string,
    recipient: address || "",
    artifactsToMint: "3",
    minterReward: "1",
    maxArtifactPrice: "0.001",
    fundingAmount: "0.5",
  });

  const {
    writeContract,
    data: hash,
    error: writeError,
    isPending: isWritePending,
  } = useWriteContract();

  const { isLoading: isReceiptLoading, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const ownerArtifacts = Number(formData.artifactsToMint) - Number(formData.minterReward);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setTxStatus("confirming");

      await writeContract({
        address: bountyContractAddress,
        abi: abiMintBounty,
        functionName: "createBounty",
        args: [
          formData.tokenContract as Address,
          (formData.recipient || address) as Address,
          BigInt(formData.artifactsToMint),
          BigInt(formData.minterReward),
          parseEther(formData.maxArtifactPrice),
        ],
        value: parseEther(formData.fundingAmount),
      });

      setTxStatus("processing");
    } catch (error) {
      console.error("Create bounty error:", error);
      setTxStatus("error");
    }
  };

  React.useEffect(() => {
    if (isSuccess) {
      setTxStatus("success");
      onSuccess?.();
    }
  }, [isSuccess, onSuccess]);

  React.useEffect(() => {
    if (writeError) {
      setTxStatus("error");
    }
  }, [writeError]);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-lg font-bold mb-4">Create New Bounty</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Token Contract Address
          </label>
          <input
            type="text"
            value={formData.tokenContract}
            onChange={(e) => setFormData({ ...formData, tokenContract: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono"
            placeholder="0x..."
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Recipient Address
          </label>
          <input
            type="text"
            value={formData.recipient}
            onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
            placeholder={address || "0x..."}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono"
          />
          <p className="text-xs text-gray-500 mt-1">
            Leave empty to use your connected wallet
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Total Artifacts to Mint
            </label>
            <input
              type="number"
              min="1"
              value={formData.artifactsToMint}
              onChange={(e) => setFormData({ ...formData, artifactsToMint: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Artifacts for Claimer
            </label>
            <input
              type="number"
              min="0"
              max={formData.artifactsToMint}
              value={formData.minterReward}
              onChange={(e) => setFormData({ ...formData, minterReward: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              required
            />
          </div>
        </div>

        <div className="bg-gray-50 p-3 rounded text-sm">
          <p className="font-medium mb-1">Distribution Preview:</p>
          <p className="text-gray-600">
            Owner receives: <span className="font-bold">{ownerArtifacts}</span> artifacts
          </p>
          <p className="text-gray-600">
            Claimer receives: <span className="font-bold">{formData.minterReward}</span> artifacts
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Max Price per Artifact (ETH)
            </label>
            <input
              type="number"
              step="0.0001"
              min="0"
              value={formData.maxArtifactPrice}
              onChange={(e) => setFormData({ ...formData, maxArtifactPrice: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Initial Funding (ETH)
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={formData.fundingAmount}
              onChange={(e) => setFormData({ ...formData, fundingAmount: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isWritePending || isReceiptLoading}
          className={`w-full py-3 px-4 rounded font-medium transition-colors ${
            isWritePending || isReceiptLoading
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-black text-white hover:bg-gray-800"
          }`}
        >
          {isWritePending
            ? "Confirm in wallet..."
            : isReceiptLoading
            ? "Creating bounty..."
            : `Create Bounty (${formData.fundingAmount} ETH)`}
        </button>
      </form>

      <TransactionStatus
        status={txStatus}
        hash={hash}
        error={writeError?.message}
        successMessage="Bounty created successfully!"
      />
    </div>
  );
};