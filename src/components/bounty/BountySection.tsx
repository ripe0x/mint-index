import React, { useState, useEffect } from "react";
import { Address } from "viem";
import { fetchAllBounties } from "@/lib/fetchBountyEvents";
import { BountyData } from "@/types/bounty";
import { BountyItem } from "./BountyItem";
import Link from "next/link";

interface BountySectionProps {
  tokenContract: Address;
  tokenId: number;
}

export function BountySection({ tokenContract, tokenId }: BountySectionProps) {
  const [bounties, setBounties] = useState<BountyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function fetchBounties() {
      if (!tokenContract) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Fetch all bounties (including inactive) and filter for this specific token
        const allBounties = await fetchAllBounties(false);
        const relevantBounties = allBounties.filter(
          (bounty) =>
            bounty.tokenContract.toLowerCase() === tokenContract.toLowerCase() &&
            (bounty.lastMintedId === 0 || bounty.lastMintedId === tokenId)
        );
        setBounties(relevantBounties);
      } catch (error) {
        console.error("Error fetching bounties:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchBounties();
  }, [tokenContract, tokenId]);

  // Don't render during SSR
  if (!mounted) {
    return null;
  }

  if (loading) {
    return (
      <div className="border border-gray-200 rounded-lg p-6 mb-4">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-32 mb-3"></div>
          <div className="h-4 bg-gray-200 rounded w-48"></div>
        </div>
      </div>
    );
  }

  if (bounties.length === 0) {
    return (
      <div className="border border-gray-200 rounded-lg p-6 mb-4">
        <h3 className="text-md font-semibold mb-2">Bounties</h3>
        <p className="text-[12px] opacity-70 mb-3">
          No active bounties for this token.
        </p>
        <Link
          href="/bounty"
          className="text-[12px] text-blue-600 hover:underline"
        >
          Learn more about bounties →
        </Link>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg p-6 mb-4">
      <h3 className="text-md font-semibold mb-4">Bounties</h3>

      {/* Render all bounties - BountyItem will check claimability */}
      {bounties.length > 0 ? (
        <div className="space-y-4">
          {bounties.map((bounty, index) => (
            <BountyItem key={`${bounty.bountyContract}-${index}`} bounty={bounty} />
          ))}
        </div>
      ) : (
        <p className="text-[12px] opacity-70">
          No bounties found for this token.
        </p>
      )}

      <div className="mt-4 pt-4 border-t border-gray-200">
        <Link
          href="/bounty"
          className="text-[12px] text-blue-600 hover:underline"
        >
          View all bounties →
        </Link>
      </div>
    </div>
  );
}