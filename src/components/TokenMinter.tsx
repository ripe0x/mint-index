import { useEffect, useState } from "react";
import { useAccount, useWriteContract, useTransaction, useBlock } from "wagmi";
import { formatEther, type Hash } from "viem";
import { abi1155 } from "@/abi/abi1155";
import { client } from "@/config";

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
  const [mintPrice, setMintPrice] = useState<bigint>(BigInt(0));
  const { isConnected, address } = useAccount();

  // Watch for new blocks to update price
  const { data: blockData } = useBlock({
    watch: true,
  });

  const {
    writeContractAsync: mint,
    isPending: isMinting,
    error: mintError,
  } = useWriteContract();

  const { isLoading: isWaitingTx, isSuccess: mintSuccess } = useTransaction({
    hash: txHash,
  });

  // Calculate mint price based on contract logic
  const calculateMintPrice = (baseFee: bigint, amount: string): bigint => {
    const unitPrice = baseFee * BigInt(60000);
    return unitPrice * BigInt(amount);
  };

  const handleMint = async () => {
    if (!tokenId || !amount || !address || !blockData?.baseFeePerGas) return;

    setTxHash(undefined);

    try {
      // get latest block data
      const block = await client.getBlock();

      // Calculate price based on current block's base fee
      const price = calculateMintPrice(
        block?.baseFeePerGas || BigInt(0),
        amount
      );

      const hash = await mint({
        address: contractAddress,
        abi: abi1155,
        functionName: "mint",
        args: [BigInt(tokenId), BigInt(amount)],
        value: price, // Send the exact required amount
      });

      if (hash) {
        setTxHash(hash);
      }
    } catch (err) {
      console.error("Mint error:", err);
      if (err instanceof Error) {
        if (err.message.includes("MintPriceNotMet")) {
          alert("Price increased during transaction. Please try again.");
        } else if (err.message.includes("MintClosed")) {
          alert("Minting window has closed for this token.");
        } else if (err.message.includes("NonExistentToken")) {
          alert("This token does not exist.");
        } else if (err.message.includes("user rejected")) {
          return;
        }
      }
    }
  };

  // Update price when block changes or amount changes
  useEffect(() => {
    if (blockData?.baseFeePerGas) {
      const newPrice = calculateMintPrice(blockData.baseFeePerGas, amount);
      setMintPrice(newPrice);
    }
  }, [blockData?.baseFeePerGas, amount]);

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
                !tokenId ||
                !amount ||
                isMinting ||
                (txHash && isWaitingTx) ||
                !blockData?.baseFeePerGas
              }
              className="text-xs w-full bg-black text-white px-2 py-1 hover:bg-gray-900 disabled:bg-gray-400 transition-colors hover:cursor-pointer"
            >
              {(txHash && isWaitingTx) || isMinting
                ? "Processing..."
                : `Mint (${formatETH(mintPrice)} ETH)`}
            </button>
          </div>

          {mintError && (
            <div className="text-[10px] p-3 bg-red-50 text-red-700 rounded-md text-sm leading-snug text-wrap">
              {mintError instanceof Error
                ? mintError.message
                : "An error occurred during minting"}
            </div>
          )}

          {mintSuccess && txHash && (
            <div className="text-[12px] p-3 bg-green-50 text-green-700 rounded-md">
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
