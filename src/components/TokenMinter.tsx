import { useState } from "react";
import {
  useAccount,
  useWriteContract,
  useWatchContractEvent,
  useTransaction,
  useBlock,
} from "wagmi";
import { formatEther, type Hash } from "viem";
import { abi1155 } from "@/abi/abi1155";

interface MinterProps {
  contractAddress: `0x${string}`;
  tokenId: number;
}

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
  return (
    <div>
      {!isConnected ? (
        <p className="mb-4 text-[12px] w-full text-center px-2 py-1 bg-gray-200 text-gray-700">
          Connect to mint
        </p>
      ) : (
        <div className="mt-4">
          <div className="flex flex-row gap-2 mb-2">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-xs w-1/4 px-2 py-1 border border-gray-300"
              min="1"
            />

            <button
              onClick={handleMint}
              disabled={
                !tokenId || !amount || isMinting || (txHash && isWaitingTx)
              }
              className="text-xs w-full bg-black text-white px-2 py-1 hover:bg-gray-900 disabled:bg-gray-400 transition-colors hover:cursor-pointer"
            >
              {(txHash && isWaitingTx) || isMinting
                ? "Processing..."
                : `Mint (${formatETH(totalPrice)} ETH)`}
            </button>
          </div>

          {/* {tokenInfo && (
            <div className="p-3 bg-gray-50 rounded-md space-y-1">
              <p className="text-[12px] text-gray-600">
                Price per token: {formatETH(baseFee)} ETH
              </p>
              <p className="text-[12px]">
                Total price: {formatETH(totalPrice)} ETH
              </p>
            </div>
          )} */}

          {mintError && (
            <div className="text-[12px] p-3 bg-red-50 text-red-700 rounded-md text-sm">
              {(mintError as Error).message}
            </div>
          )}

          {mintSuccess && txHash && (
            <div className="text-[12px] p-3 bg-green-50 text-green-700 rounded-md ">
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
