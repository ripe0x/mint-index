import React, { useState, useEffect } from "react";
import Head from "next/head";
import { useAccount } from "wagmi";
import { Address } from "viem";
import { fetchBountyFactoryEvents } from "@/lib/fetchBountyEvents";
import { BountyDeploySection } from "@/components/bounty/BountyDeploySection";
import { BountyCreateForm } from "@/components/bounty/BountyCreateForm";
import { BountyList } from "@/components/bounty/BountyList";

export default function BountyPage() {
  const { address, isConnected } = useAccount();
  const [ownedContracts, setOwnedContracts] = useState<Address[]>([]);
  const [selectedContract, setSelectedContract] = useState<Address | null>(
    null
  );
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Check if user owns any bounty contracts
  useEffect(() => {
    async function checkOwnedContracts() {
      if (!address) {
        setOwnedContracts([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const contracts = await fetchBountyFactoryEvents(address);
        const contractAddresses = contracts.map((c) => c.bountyContract);
        setOwnedContracts(contractAddresses);

        // Auto-select first contract if available
        if (contractAddresses.length > 0 && !selectedContract) {
          setSelectedContract(contractAddresses[0]);
        }
      } catch (error) {
        console.error("Error fetching owned contracts:", error);
      } finally {
        setLoading(false);
      }
    }

    checkOwnedContracts();
  }, [address, selectedContract]);

  const handleDeploySuccess = (contractAddress: Address) => {
    setOwnedContracts([...ownedContracts, contractAddress]);
    setSelectedContract(contractAddress);
    setShowCreateForm(true);
  };

  return (
    <>
      <Head>
        <title>MintBounty - Manage Bounty Contracts</title>
        <meta
          name="description"
          content="Deploy & manage MintBounty contracts on Mint Protocol"
        />
      </Head>

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">MintBounty</h1>
            <p className="text-gray-600">
              Deploy, manage, and claim bounties for NFT minting on{" "}
              <a
                href="https://networked.art/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Mint Protocol
              </a>
            </p>
          </div>

          {/* Loading state during hydration */}
          {!mounted ? (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center mb-8">
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-48 mx-auto mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-64 mx-auto"></div>
              </div>
            </div>
          ) : (
            <>
              {/* Connection prompt for non-connected users */}
              {/* {!isConnected && (
                <div className="bg-white border border-gray-200 rounded-lg p-6 text-center mb-8">
                  <h2 className="text-lg font-medium mb-3">Connect to Deploy & Manage</h2>
                  <p className="text-gray-600 mb-4 text-sm">
                    Connect your wallet to deploy contracts, create bounties, and claim rewards
                  </p>
                  <div className="flex justify-center">
                    <ConnectButton />
                  </div>
                </div>
              )} */}

              {/* All Bounties Section - Always visible */}
              <div className="mb-8">
                <BountyList />
              </div>

              {/* Your Bounty Contracts Section - Only show if connected and user has contracts */}
              {isConnected && (loading || ownedContracts.length > 0) && (
                <div className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">
                    Your Bounty Contracts
                  </h2>

                  {loading ? (
                    <div className="animate-pulse">
                      <div className="h-32 bg-gray-200 rounded-lg"></div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Contract Selector */}
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <label className="block text-sm font-medium mb-2">
                          Select Bounty Contract
                        </label>
                        <select
                          value={selectedContract || ""}
                          onChange={(e) =>
                            setSelectedContract(e.target.value as Address)
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono"
                        >
                          {ownedContracts.map((contract) => (
                            <option key={contract} value={contract}>
                              {contract}
                            </option>
                          ))}
                        </select>

                        <div className="mt-4 flex gap-2">
                          <a
                            href={`https://etherscan.io/address/${selectedContract}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline"
                          >
                            View on Etherscan →
                          </a>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={() => setShowCreateForm(!showCreateForm)}
                          className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition-colors"
                        >
                          {showCreateForm
                            ? "Hide Create Form"
                            : "Create New Bounty"}
                        </button>
                      </div>

                      {/* Create Form */}
                      {showCreateForm && selectedContract && (
                        <BountyCreateForm
                          bountyContractAddress={selectedContract}
                          onSuccess={() => {
                            setShowCreateForm(false);
                            // Trigger refresh of bounty list
                            window.location.reload();
                          }}
                        />
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Deploy Section - Only show if connected */}
              {isConnected && (
                <div className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">
                    Deploy New Bounty Contract
                  </h2>
                  <BountyDeploySection onDeploySuccess={handleDeploySuccess} />
                </div>
              )}
            </>
          )}

          {/* Info Section */}
          <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-bold mb-3">How MintBounty Works</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start">
                <span className="mr-2">1.</span>
                <span>
                  Deploy your own bounty contract for ~67k gas (93% cheaper than
                  direct deployment)
                </span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">2.</span>
                <span>
                  Create bounties for contracts on the{" "}
                  <a
                    href="https://github.com/visualizevalue/mint"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Mint protocol
                  </a>
                  , setting rewards and parameters
                </span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">3.</span>
                <span>
                  Fund bounties with ETH to cover gas refunds and enable
                  claiming
                </span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">4.</span>
                <span>
                  Claimers mint NFTs and receive automatic gas refunds from the
                  bounty balance
                </span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">5.</span>
                <span>
                  Manage your bounties: update parameters, add/withdraw funds,
                  or withdraw NFTs
                </span>
              </li>
            </ul>

            <div className="mt-4 pt-4 border-t border-blue-200">
              <p className="text-sm text-gray-600">
                <strong>Factory Contract:</strong>{" "}
                <a
                  href="https://etherscan.io/address/0x1Bf79888027B7EeE2e5B30890DbfD9157EB4C06a"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs sm:text-sm text-blue-600 hover:underline break-all"
                >
                  0x1Bf79888027B7EeE2e5B30890DbfD9157EB4C06a
                </a>
              </p>
              <p className="text-sm text-gray-600 mt-1">
                <strong>Default Token Contract:</strong>{" "}
                <a
                  href="https://etherscan.io/address/0xBA1901b542Aa58f181F7ae18eD6Cd79FdA779C62"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs sm:text-sm text-blue-600 hover:underline break-all"
                >
                  0xBA1901b542Aa58f181F7ae18eD6Cd79FdA779C62
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
