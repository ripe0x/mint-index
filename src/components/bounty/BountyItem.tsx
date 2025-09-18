import React from "react";
import { useAccount, useReadContract } from "wagmi";
import { abiMintBountyNew } from "@/abi/abiMintBountyNew";
import { BountyData } from "@/types/bounty";
import { BountyClaimButton } from "./BountyClaimButton";
import DisplayName from "@/components/DisplayName";

interface BountyItemProps {
  bounty: BountyData;
}

export function BountyItem({ bounty }: BountyItemProps) {
  const { isConnected } = useAccount();

  // Check if claimable from the contract
  const { data: isClaimable } = useReadContract({
    address: bounty.bountyContract,
    abi: abiMintBountyNew,
    functionName: "isBountyClaimable",
    args: [bounty.tokenContract],
  });

  // Check if actually claimable
  const isActive = bounty.isActive && bounty.balance > 0n && !!isClaimable;

  return (
    <div className="border border-gray-100 rounded-lg p-3 bg-gray-50">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[12px] font-medium">
            Bounty reward: 1 token
          </p>
          <p className="text-[11px] opacity-70">
            From <DisplayName address={bounty.owner} />
          </p>
        </div>

        {/* Always show claim button, but disabled if not claimable */}
        <div className="flex items-center gap-2">
          <BountyClaimButton
            bountyContract={bounty.bountyContract}
            tokenContract={bounty.tokenContract}
            gasRefundAmount={bounty.gasRefundAmount}
            isActive={isActive}
            balance={bounty.balance}
            claimedCount={bounty.claimedCount}
            maxClaims={bounty.maxClaims}
            disabled={!isConnected}
            compact={true}
          />
        </div>
      </div>
    </div>
  );
}