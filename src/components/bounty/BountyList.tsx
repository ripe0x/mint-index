import React, { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { fetchAllBounties } from "@/lib/fetchBountyEvents";
import { BountyData } from "@/types/bounty";
import { BountyCard } from "./BountyCard";

export const BountyList: React.FC = () => {
  const { address } = useAccount();
  const [bounties, setBounties] = useState<BountyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    async function loadBounties() {
      setLoading(true);
      try {
        // Get all bounties (including inactive ones)
        const allBounties = await fetchAllBounties(false);
        setBounties(allBounties);
      } catch (error) {
        console.error("Error loading bounties:", error);
      } finally {
        setLoading(false);
      }
    }

    loadBounties();
  }, [refreshKey]);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const activeBounties = bounties.filter((b) => b.isActive && b.balance > 0n);
  const inactiveBounties = bounties.filter(
    (b) => !b.isActive || b.balance === 0n
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-32 bg-gray-200 rounded-lg mb-4"></div>
          <div className="h-32 bg-gray-200 rounded-lg mb-4"></div>
          <div className="h-32 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        {/* <button
          onClick={handleRefresh}
          className="px-4 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50 transition-colors"
        >
          🔄 Refresh
        </button> */}
      </div>

      {/* Active Bounties */}
      {activeBounties.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Active Bounties</h3>
          <div className="space-y-4">
            {activeBounties.map((bounty) => (
              <BountyCard
                key={`${bounty.bountyContract}-${bounty.tokenContract}`}
                bountyContract={bounty.bountyContract}
                tokenContract={bounty.tokenContract}
                isOwner={
                  address
                    ? bounty.owner.toLowerCase() === address.toLowerCase()
                    : false
                }
                onUpdate={handleRefresh}
              />
            ))}
          </div>
        </div>
      )}

      {/* Inactive/Claimed Bounties */}
      {inactiveBounties.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4 opacity-60">
            Inactive / Claimed Bounties
          </h3>
          <div className="space-y-4 opacity-60">
            {inactiveBounties.map((bounty) => (
              <BountyCard
                key={`${bounty.bountyContract}-${bounty.tokenContract}`}
                bountyContract={bounty.bountyContract}
                tokenContract={bounty.tokenContract}
                isOwner={
                  address
                    ? bounty.owner.toLowerCase() === address.toLowerCase()
                    : false
                }
                onUpdate={handleRefresh}
              />
            ))}
          </div>
        </div>
      )}

      {bounties.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No bounties found. Deploy a bounty contract below to get started.
        </div>
      )}
    </div>
  );
};
