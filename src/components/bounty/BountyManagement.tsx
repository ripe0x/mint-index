import React, { useState } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { Address, parseEther, formatEther } from "viem";
import { abiMintBounty } from "@/abi/abiMintBounty";
import { formatETH } from "@/lib/bountyHelpers";
import { TransactionStatus } from "./TransactionStatus";

interface BountyManagementProps {
  bountyContract: Address;
  tokenContract: Address;
  onUpdate?: () => void;
}

export const BountyManagement: React.FC<BountyManagementProps> = ({
  bountyContract,
  tokenContract,
  onUpdate,
}) => {
  const { address } = useAccount();
  const [activeModal, setActiveModal] = useState<"update" | "fund" | "withdraw" | "artifacts" | null>(null);
  const [txStatus, setTxStatus] = useState<"idle" | "confirming" | "processing" | "success" | "error">("idle");

  // Form states
  const [updateForm, setUpdateForm] = useState({
    recipient: "",
    paused: false,
    artifactsToMint: "3",
    minterReward: "1",
    maxArtifactPrice: "0.001",
  });

  const [fundAmount, setFundAmount] = useState("0.1");
  const [withdrawAmount, setWithdrawAmount] = useState("0.1");
  const [selectedArtifacts, setSelectedArtifacts] = useState<string[]>([]);
  const [artifactRecipient, setArtifactRecipient] = useState(address || "");

  // Read bounty details
  const { data: bountyData, refetch } = useReadContract({
    address: bountyContract,
    abi: abiMintBounty,
    functionName: "bounties",
    args: [tokenContract],
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

  React.useEffect(() => {
    if (bountyData && activeModal === "update") {
      setUpdateForm({
        recipient: bountyData[0],
        paused: bountyData[1],
        artifactsToMint: bountyData[3].toString(),
        minterReward: bountyData[4].toString(),
        maxArtifactPrice: formatEther(bountyData[5]),
      });
    }
  }, [bountyData, activeModal]);

  React.useEffect(() => {
    if (isSuccess) {
      setTxStatus("success");
      refetch();
      onUpdate?.();
      setTimeout(() => {
        setActiveModal(null);
        setTxStatus("idle");
      }, 2000);
    }
  }, [isSuccess, refetch, onUpdate]);

  React.useEffect(() => {
    if (writeError) {
      setTxStatus("error");
    }
  }, [writeError]);

  const handleUpdate = async () => {
    try {
      setTxStatus("confirming");

      await writeContract({
        address: bountyContract,
        abi: abiMintBounty,
        functionName: "updateBounty",
        args: [
          tokenContract,
          updateForm.recipient as Address,
          updateForm.paused,
          BigInt(updateForm.artifactsToMint),
          BigInt(updateForm.minterReward),
          parseEther(updateForm.maxArtifactPrice),
        ],
      });

      setTxStatus("processing");
    } catch (error) {
      console.error("Update error:", error);
      setTxStatus("error");
    }
  };

  const handleFund = async () => {
    try {
      setTxStatus("confirming");

      await writeContract({
        address: bountyContract,
        abi: abiMintBounty,
        functionName: "fundBounty",
        args: [tokenContract],
        value: parseEther(fundAmount),
      });

      setTxStatus("processing");
    } catch (error) {
      console.error("Fund error:", error);
      setTxStatus("error");
    }
  };

  const handleWithdraw = async () => {
    try {
      setTxStatus("confirming");

      await writeContract({
        address: bountyContract,
        abi: abiMintBounty,
        functionName: "withdrawBalance",
        args: [tokenContract, parseEther(withdrawAmount)],
      });

      setTxStatus("processing");
    } catch (error) {
      console.error("Withdraw error:", error);
      setTxStatus("error");
    }
  };

  const handleWithdrawArtifacts = async () => {
    if (selectedArtifacts.length === 0) return;

    try {
      setTxStatus("confirming");

      await writeContract({
        address: bountyContract,
        abi: abiMintBounty,
        functionName: "withdrawArtifacts",
        args: [
          tokenContract,
          selectedArtifacts.map((id) => BigInt(id)),
          artifactRecipient as Address,
        ],
      });

      setTxStatus("processing");
    } catch (error) {
      console.error("Withdraw artifacts error:", error);
      setTxStatus("error");
    }
  };

  if (!bountyData) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveModal("update")}
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
        >
          Update Bounty
        </button>
        <button
          onClick={() => setActiveModal("fund")}
          className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors"
        >
          Fund Bounty
        </button>
        <button
          onClick={() => setActiveModal("withdraw")}
          className="px-4 py-2 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 transition-colors"
        >
          Withdraw ETH
        </button>
        <button
          onClick={() => setActiveModal("artifacts")}
          className="px-4 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 transition-colors"
        >
          Withdraw Artifacts
        </button>
      </div>

      {/* Update Modal */}
      {activeModal === "update" && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">Update Bounty</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Recipient</label>
                <input
                  type="text"
                  value={updateForm.recipient}
                  onChange={(e) => setUpdateForm({ ...updateForm, recipient: e.target.value })}
                  className="w-full px-3 py-2 border rounded text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  value={updateForm.paused ? "paused" : "active"}
                  onChange={(e) => setUpdateForm({ ...updateForm, paused: e.target.value === "paused" })}
                  className="w-full px-3 py-2 border rounded text-sm"
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Total Artifacts</label>
                  <input
                    type="number"
                    min="1"
                    value={updateForm.artifactsToMint}
                    onChange={(e) => setUpdateForm({ ...updateForm, artifactsToMint: e.target.value })}
                    className="w-full px-3 py-2 border rounded text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Minter Reward</label>
                  <input
                    type="number"
                    min="0"
                    value={updateForm.minterReward}
                    onChange={(e) => setUpdateForm({ ...updateForm, minterReward: e.target.value })}
                    className="w-full px-3 py-2 border rounded text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Max Artifact Price (ETH)</label>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={updateForm.maxArtifactPrice}
                  onChange={(e) => setUpdateForm({ ...updateForm, maxArtifactPrice: e.target.value })}
                  className="w-full px-3 py-2 border rounded text-sm"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleUpdate}
                disabled={isWritePending || isReceiptLoading}
                className="flex-1 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300"
              >
                {isWritePending ? "Confirming..." : isReceiptLoading ? "Updating..." : "Update"}
              </button>
              <button
                onClick={() => { setActiveModal(null); setTxStatus("idle"); }}
                className="flex-1 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>

            <TransactionStatus status={txStatus} hash={hash} error={writeError?.message} />
          </div>
        </div>
      )}

      {/* Fund Modal */}
      {activeModal === "fund" && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">Fund Bounty</h3>

            <div>
              <label className="block text-sm font-medium mb-1">Amount (ETH)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value)}
                className="w-full px-3 py-2 border rounded text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                Current balance: {formatETH(bountyData[6])} ETH
              </p>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleFund}
                disabled={isWritePending || isReceiptLoading}
                className="flex-1 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-300"
              >
                {isWritePending ? "Confirming..." : isReceiptLoading ? "Funding..." : `Fund ${fundAmount} ETH`}
              </button>
              <button
                onClick={() => { setActiveModal(null); setTxStatus("idle"); }}
                className="flex-1 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>

            <TransactionStatus status={txStatus} hash={hash} error={writeError?.message} />
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {activeModal === "withdraw" && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">Withdraw ETH</h3>

            <div>
              <label className="block text-sm font-medium mb-1">Amount (ETH)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max={formatEther(bountyData[6])}
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="w-full px-3 py-2 border rounded text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                Available: {formatETH(bountyData[6])} ETH
              </p>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleWithdraw}
                disabled={isWritePending || isReceiptLoading}
                className="flex-1 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:bg-gray-300"
              >
                {isWritePending ? "Confirming..." : isReceiptLoading ? "Withdrawing..." : "Withdraw"}
              </button>
              <button
                onClick={() => { setActiveModal(null); setTxStatus("idle"); }}
                className="flex-1 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>

            <TransactionStatus status={txStatus} hash={hash} error={writeError?.message} />
          </div>
        </div>
      )}

      {/* Withdraw Artifacts Modal */}
      {activeModal === "artifacts" && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">Withdraw Artifacts</h3>

            <p className="text-sm text-gray-600 mb-3">
              Select the token IDs you want to withdraw:
            </p>

            <div className="space-y-2 max-h-40 overflow-y-auto mb-3">
              <p className="text-xs text-gray-500">
                Enter comma-separated token IDs (e.g., 1,2,3)
              </p>
              <input
                type="text"
                placeholder="1,2,3"
                onChange={(e) => setSelectedArtifacts(e.target.value.split(",").map(s => s.trim()).filter(s => s))}
                className="w-full px-3 py-2 border rounded text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Recipient</label>
              <input
                type="text"
                value={artifactRecipient}
                onChange={(e) => setArtifactRecipient(e.target.value)}
                placeholder={address}
                className="w-full px-3 py-2 border rounded text-sm font-mono"
              />
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleWithdrawArtifacts}
                disabled={isWritePending || isReceiptLoading || selectedArtifacts.length === 0}
                className="flex-1 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-300"
              >
                {isWritePending ? "Confirming..." : isReceiptLoading ? "Withdrawing..." : `Withdraw ${selectedArtifacts.length} NFTs`}
              </button>
              <button
                onClick={() => { setActiveModal(null); setTxStatus("idle"); }}
                className="flex-1 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>

            <TransactionStatus status={txStatus} hash={hash} error={writeError?.message} />
          </div>
        </div>
      )}
    </div>
  );
};