import { formatEther } from "viem";

export const FACTORY_ADDRESS = "0x1Bf79888027B7EeE2e5B30890DbfD9157EB4C06a" as const;
export const DEFAULT_TOKEN_CONTRACT = "0xBA1901b542Aa58f181F7ae18eD6Cd79FdA779C62" as const;

export function formatETH(value: bigint, decimals: number = 4): string {
  const formatted = formatEther(value);
  const num = parseFloat(formatted);
  return num.toFixed(decimals);
}

export function formatETHWithUSD(value: bigint, ethPrice: number = 3000): {
  eth: string;
  usd: string;
} {
  const eth = formatETH(value);
  const usd = (parseFloat(eth) * ethPrice).toFixed(2);
  return { eth, usd };
}

export type BountyStatus =
  | "claimable"
  | "paused"
  | "already_claimed"
  | "insufficient_balance"
  | "not_available";

export function getBountyStatusDisplay(status: BountyStatus): {
  emoji: string;
  text: string;
  color: string;
} {
  switch (status) {
    case "claimable":
      return { emoji: "✅", text: "Claimable", color: "text-green-600" };
    case "paused":
      return { emoji: "⏸️", text: "Paused", color: "text-gray-500" };
    case "already_claimed":
      return { emoji: "🔄", text: "Already Claimed", color: "text-gray-500" };
    case "insufficient_balance":
      return { emoji: "💸", text: "Insufficient Balance", color: "text-yellow-600" };
    case "not_available":
      return { emoji: "⏳", text: "Not Available", color: "text-gray-500" };
  }
}

export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function calculateGasEstimate(gasUnits: bigint, gasPrice: bigint): bigint {
  return gasUnits * gasPrice;
}