import { useState } from "react";
import {
  useAccount,
  useWriteContract,
  useReadContract,
  useWatchContractEvent,
  useTransaction,
  useBlock,
} from "wagmi";
import { formatEther, type Hash } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { abi1155 } from "@/abi/abi1155";

interface MinterProps {
  contractAddress: `0x${string}`;
  tokenId: number;
}

const contractAbi = abi1155; // Your provided ABI goes here

const formatETH = (value: bigint) => {
  return Number(formatEther(value)).toFixed(5);
};

export default function TokenMinter({ contractAddress, tokenId }: MinterProps) {
  const [amount, setAmount] = useState<string>("1");
  const [txHash, setTxHash] = useState<Hash>();
  const { isConnected } = useAccount();
  const block = useBlock({
    watch: true,
  });
  const baseFee =
    (block.data?.baseFeePerGas ?? BigInt(0)) * BigInt(60000) || BigInt(0);

  // Read token info and price
  const { data: tokenInfo } = useReadContract({
    address: contractAddress,
    abi: contractAbi,
    functionName: "get",
    args: [BigInt(tokenId || "0")],
    query: {
      enabled: Boolean(tokenId),
    },
  });

  // Calculate total mint price (price per token * amount)
  const totalPrice = baseFee * BigInt(amount || "1");

  // Write interaction for minting
  const {
    writeContractAsync: mint,
    isPending: isMinting,
    error: mintError,
  } = useWriteContract();

  // Watch for NewMint events
  useWatchContractEvent({
    address: contractAddress,
    abi: contractAbi,
    eventName: "NewMint",
    onLogs(logs) {
      console.log("New mint event:", logs);
    },
  });

  // Transaction status
  const { isLoading: isWaitingTx, isSuccess: mintSuccess } = useTransaction({
    hash: txHash,
  });

  const handleMint = async () => {
    if (!tokenId || !amount) return;

    try {
      const hash = await mint({
        address: contractAddress,
        abi: contractAbi,
        functionName: "mint",
        args: [BigInt(tokenId), BigInt(amount)],
        value: totalPrice, // Send the correct amount of ETH
      });

      if (hash) {
        setTxHash(hash);
      }
    } catch (err) {
      console.error("Mint error:", err);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h1 className="font-bold text-xl">Mint</h1>

      {!isConnected ? (
        <div className="mb-6">
          <ConnectButton />
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              min="1"
            />
          </div>

          {tokenInfo && (
            <div className="p-4 bg-gray-50 rounded-md ">
              <p>Price per token: {formatETH(baseFee)} ETH</p>
              <p className="font-medium">
                Total price: {formatETH(totalPrice)} ETH
              </p>
            </div>
          )}

          <button
            onClick={handleMint}
            disabled={!tokenId || !amount || isMinting || isWaitingTx}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
          >
            {isMinting || isWaitingTx
              ? "Processing..."
              : `Mint Tokens (${formatETH(totalPrice)} ETH)`}
          </button>

          {mintError && (
            <div className="p-4 bg-red-50 text-red-700 rounded-md">
              {(mintError as Error).message}
            </div>
          )}

          {mintSuccess && txHash && (
            <div className="p-4 bg-green-50 text-green-700 rounded-md">
              Successfully minted tokens!
              <a
                href={`https://etherscan.io/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block mt-2 text-green-600 hover:underline"
              >
                View on Etherscan
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
