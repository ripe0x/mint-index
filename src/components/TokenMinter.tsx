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
import { ChevronDown, ChevronUp } from "lucide-react";

interface MinterProps {
  contractAddress: `0x${string}`;
  tokenId: number;
}

const formatETH = (value: bigint) => {
  return Number(formatEther(value)).toFixed(5);
};

export default function TokenMinter({ contractAddress, tokenId }: MinterProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [amount, setAmount] = useState<string>("1");
  const [txHash, setTxHash] = useState<Hash>();
  const { isConnected } = useAccount();

  const block = useBlock({
    watch: true,
  });
  const baseFee =
    (block.data?.baseFeePerGas ?? BigInt(0)) * BigInt(60000) || BigInt(0);

  const { data: tokenInfo } = useReadContract({
    address: contractAddress,
    abi: abi1155,
    functionName: "get",
    args: [BigInt(tokenId || "0")],
    query: {
      enabled: Boolean(tokenId),
    },
  });

  const totalPrice = baseFee * BigInt(amount || "1");

  const {
    writeContractAsync: mint,
    isPending: isMinting,
    error: mintError,
  } = useWriteContract();

  useWatchContractEvent({
    address: contractAddress,
    abi: abi1155,
    eventName: "NewMint",
    onLogs(logs) {
      console.log("New mint event:", logs);
    },
  });

  const { isLoading: isWaitingTx, isSuccess: mintSuccess } = useTransaction({
    hash: txHash,
  });

  const handleMint = async () => {
    if (!tokenId || !amount) return;

    try {
      const hash = await mint({
        address: contractAddress,
        abi: abi1155,
        functionName: "mint",
        args: [BigInt(tokenId), BigInt(amount)],
        value: totalPrice,
      });

      if (hash) {
        setTxHash(hash);
      }
    } catch (err) {
      console.error("Mint error:", err);
    }
  };

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="w-full flex items-center justify-center gap-2 py-2 px-4 mt-4 rounded-md hover:bg-gray-200 transition-colors border-t border-gray-300 border-top-solid hover:border-transparent"
      >
        <span>Mint</span>
        <ChevronDown className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div>
      {/* <div className="flex items-center justify-between mt-4">
        <h2 className="font-bold text-lg">Mint Token</h2>
        <button
          onClick={() => setIsExpanded(false)}
          className="text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
      </div> */}

      {!isConnected ? (
        <div className="mb-4">
          <ConnectButton />
        </div>
      ) : (
        <div className="mt-4">
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
            <div className="p-3 bg-gray-50 rounded-md space-y-1">
              <p className="text-sm text-gray-600">
                Price per token: {formatETH(baseFee)} ETH
              </p>
              <p className="font-medium">
                Total price: {formatETH(totalPrice)} ETH
              </p>
            </div>
          )}

          <button
            onClick={handleMint}
            disabled={!tokenId || !amount || isMinting || isWaitingTx}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            {isMinting || isWaitingTx
              ? "Processing..."
              : `Mint Tokens (${formatETH(totalPrice)} ETH)`}
          </button>

          {mintError && (
            <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
              {(mintError as Error).message}
            </div>
          )}

          {mintSuccess && txHash && (
            <div className="p-3 bg-green-50 text-green-700 rounded-md text-sm">
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
