import React, { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useBalance } from "wagmi";
import { Address, parseEther, formatEther } from "viem";
import { abiMintBountyNew } from "@/abi/abiMintBountyNew";
import { abi1155 } from "@/abi/abi1155";
import { formatETH } from "@/lib/bountyHelpers";
import { TransactionStatus } from "./TransactionStatus";
import { client } from "@/config";

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
  const { data: walletBalance } = useBalance({ address });
  const [activeModal, setActiveModal] = useState<"update" | "fund" | "withdraw" | "artifacts" | null>(null);
  const [txStatus, setTxStatus] = useState<"idle" | "confirming" | "processing" | "success" | "error">("idle");
  const [nftCount, setNftCount] = useState(0);
  const [nftsToWithdraw, setNftsToWithdraw] = useState<{tokenContract: Address, tokenIds: bigint[]}[]>([]);
  const [checkingNFTs, setCheckingNFTs] = useState(false);

  // Form states
  const [updateForm, setUpdateForm] = useState({
    recipient: "",
    paused: false,
    artifactsToMint: "3",
    minterReward: "1",
    maxArtifactPrice: "0.001",
  });

  const [fundAmount, setFundAmount] = useState("0.01");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  // Read bounty details using tokenContract as key
  const { data: bountyData, refetch } = useReadContract({
    address: bountyContract,
    abi: abiMintBountyNew,
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
        abi: abiMintBountyNew,
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
        abi: abiMintBountyNew,
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
        abi: abiMintBountyNew,
        functionName: "withdrawBalance",
        args: [tokenContract, parseEther(withdrawAmount)],
      });

      setTxStatus("processing");
    } catch (error) {
      console.error("Withdraw error:", error);
      setTxStatus("error");
    }
  };

  // Check NFT balances for the primary token contract
  const checkNFTBalances = async () => {
    if (!address || !bountyData) return;

    setCheckingNFTs(true);
    setNftCount(0);
    setNftsToWithdraw([]);

    try {
      const withdrawableNFTs: {tokenContract: Address, tokenIds: bigint[]}[] = [];
      let totalCount = 0;

      // Only check the primary token contract associated with this bounty
      const tokenIds: bigint[] = [];
      const tokenBalances = new Map<bigint, bigint>(); // Track balance for each token ID

      // Get the lastMintedId from bounty data to know the range
      const lastMintedId = bountyData[2] || BigInt(0);
      const startId = lastMintedId > 0n ? Number(lastMintedId) - 10 : 1;
      const endId = lastMintedId > 0n ? Number(lastMintedId) + 10 : 30;

      // Check token IDs around the lastMintedId
      for (let id = Math.max(1, startId); id <= endId; id++) {
        try {
          const balance = await client.readContract({
            address: tokenContract,
            abi: abi1155,
            functionName: "balanceOf",
            args: [bountyContract, BigInt(id)],
          });

          if (balance && balance > 0n) {
            tokenBalances.set(BigInt(id), balance);
            // For withdrawArtifacts, we need to specify each token ID we want to withdraw
            // If a token has balance > 1, we still only list it once in tokenIds
            tokenIds.push(BigInt(id));
            totalCount += Number(balance);
          }
        } catch {
          // Token ID doesn't exist, continue
        }
      }

      if (tokenIds.length > 0) {
        withdrawableNFTs.push({ tokenContract, tokenIds });
      }

      console.log("Found NFTs:", totalCount, "for token contract:", tokenContract);
      console.log("Token balances:", Array.from(tokenBalances.entries()).map(([id, bal]) => `#${id}: ${bal}`).join(", "));
      setNftsToWithdraw(withdrawableNFTs);
      setNftCount(totalCount);
    } catch (error) {
      console.error("Error checking NFT balances:", error);
      setNftCount(0);
      setNftsToWithdraw([]);
    } finally {
      setCheckingNFTs(false);
    }
  };

  // Check NFT balances when component mounts or modal opens
  useEffect(() => {
    if (activeModal === "artifacts") {
      checkNFTBalances();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeModal]);

  const handleWithdrawArtifacts = async () => {
    if (nftsToWithdraw.length === 0 || !address) return;

    try {
      setTxStatus("confirming");

      // Withdraw from each token contract that has NFTs
      for (const nft of nftsToWithdraw) {
        await writeContract({
          address: bountyContract,
          abi: abiMintBountyNew,
          functionName: "withdrawArtifacts",
          args: [
            nft.tokenContract,
            nft.tokenIds,
            address, // Send to owner's address
          ],
        });
      }

      setTxStatus("processing");
      // Refresh NFT count after withdrawal
      setTimeout(() => {
        checkNFTBalances();
      }, 3000);
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
          className="px-4 py-2 bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors"
        >
          Update Bounty
        </button>
        <button
          onClick={() => setActiveModal("fund")}
          className="px-4 py-2 bg-green-600 text-white text-sm hover:bg-green-700 transition-colors"
        >
          Fund Bounty
        </button>
        <button
          onClick={() => setActiveModal("withdraw")}
          className="px-4 py-2 bg-orange-600 text-white text-sm hover:bg-orange-700 transition-colors"
        >
          Withdraw ETH
        </button>
        <button
          onClick={() => setActiveModal("artifacts")}
          className="px-4 py-2 bg-purple-600 text-white text-sm hover:bg-purple-700 transition-colors"
        >
          Withdraw Artifacts
        </button>
      </div>

      {/* Update Modal */}
      {activeModal === "update" && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-2">Update Bounty</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Recipient</label>
                <input
                  type="text"
                  value={updateForm.recipient}
                  onChange={(e) => setUpdateForm({ ...updateForm, recipient: e.target.value })}
                  className="w-full px-3 py-2 border text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  value={updateForm.paused ? "paused" : "active"}
                  onChange={(e) => setUpdateForm({ ...updateForm, paused: e.target.value === "paused" })}
                  className="w-full px-3 py-2 border text-sm"
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
                    className="w-full px-3 py-2 border text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Minter Reward</label>
                  <input
                    type="number"
                    min="0"
                    value={updateForm.minterReward}
                    onChange={(e) => setUpdateForm({ ...updateForm, minterReward: e.target.value })}
                    className="w-full px-3 py-2 border text-sm"
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
                  className="w-full px-3 py-2 border text-sm"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleUpdate}
                disabled={isWritePending || isReceiptLoading}
                className="flex-1 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300"
              >
                {isWritePending ? "Confirming..." : isReceiptLoading ? "Updating..." : "Update"}
              </button>
              <button
                onClick={() => { setActiveModal(null); setTxStatus("idle"); }}
                className="flex-1 py-1.5 text-sm bg-gray-200 text-gray-700 hover:bg-gray-300"
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
            <h3 className="text-lg font-bold mb-2">Fund Bounty</h3>

            <div className="space-y-1">
              <label className="block text-sm font-medium">Amount (ETH)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value)}
                className="w-full px-3 py-2 border text-sm"
              />
              <p className="text-xs text-gray-500">
                Current bounty balance: {formatETH(bountyData[6])} ETH
              </p>
              <p className="text-xs text-gray-500">
                Your wallet balance: {walletBalance ? formatETH(walletBalance.value) : "0"} ETH
              </p>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleFund}
                disabled={isWritePending || isReceiptLoading}
                className="flex-1 py-1.5 text-sm bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-300"
              >
                {isWritePending ? "Confirming..." : isReceiptLoading ? "Funding..." : `Fund ${fundAmount} ETH`}
              </button>
              <button
                onClick={() => { setActiveModal(null); setTxStatus("idle"); }}
                className="flex-1 py-1.5 text-sm bg-gray-200 text-gray-700 hover:bg-gray-300"
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
            <h3 className="text-lg font-bold mb-2">Withdraw ETH</h3>

            <div className="space-y-1">
              <label className="block text-sm font-medium">Amount (ETH)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max={formatEther(bountyData[6])}
                value={withdrawAmount || formatEther(bountyData[6])}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="w-full px-3 py-2 border text-sm"
              />
              <p className="text-xs text-gray-500">
                Available: {formatETH(bountyData[6])} ETH
              </p>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleWithdraw}
                disabled={isWritePending || isReceiptLoading}
                className="flex-1 py-1.5 text-sm bg-orange-600 text-white hover:bg-orange-700 disabled:bg-gray-300"
              >
                {isWritePending ? "Confirming..." : isReceiptLoading ? "Withdrawing..." : "Withdraw"}
              </button>
              <button
                onClick={() => { setActiveModal(null); setTxStatus("idle"); }}
                className="flex-1 py-1.5 text-sm bg-gray-200 text-gray-700 hover:bg-gray-300"
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
            <h3 className="text-lg font-bold mb-2">Withdraw Artifacts</h3>

            <div className="mb-4">
              {checkingNFTs ? (
                <div className="py-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mb-2"></div>
                  <p className="text-sm text-gray-600">Checking artifact balances...</p>
                </div>
              ) : nftCount > 0 ? (
                <div>
                  <p className="text-xl font-semibold text-purple-600 mb-1">{nftCount} artifacts available</p>
                  <p className="text-xs text-gray-500 mb-2">Token IDs: {[...new Set(nftsToWithdraw.flatMap(nft => nft.tokenIds))].map(id => id.toString()).sort((a, b) => Number(a) - Number(b)).join(", ")}</p>
                  <p className="text-xs text-gray-500">Will be sent to your connected wallet</p>
                </div>
              ) : (
                <div className="py-2">
                  <p className="text-sm text-gray-500">No artifacts found in this bounty contract</p>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleWithdrawArtifacts}
                disabled={isWritePending || isReceiptLoading || nftCount === 0 || checkingNFTs}
                className="flex-1 py-1.5 text-sm bg-purple-600 text-white hover:bg-purple-700 disabled:bg-gray-300"
              >
                {isWritePending ? "Confirming..." : isReceiptLoading ? "Withdrawing..." : `Withdraw All`}
              </button>
              <button
                onClick={() => { setActiveModal(null); setTxStatus("idle"); }}
                className="flex-1 py-1.5 text-sm bg-gray-200 text-gray-700 hover:bg-gray-300"
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