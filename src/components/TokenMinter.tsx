import { useState } from "react";
import {
  useAccount,
  useWriteContract,
  useReadContract,
  useWatchContractEvent,
  useTransaction,
} from "wagmi";
import { parseEther, formatEther, type Hash } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { abi1155 } from "@/abi/abi1155";

interface MinterProps {
  contractAddress: `0x${string}`;
  tokenId: string;
}

const contractAbi = abi1155; // Your provided ABI goes here

export default function TokenMinter({ contractAddress, tokenId }: MinterProps) {
  const [amount, setAmount] = useState<string>("1");
  const [txHash, setTxHash] = useState<Hash>();
  const { isConnected } = useAccount();

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
  const mintPrice = tokenInfo ? (tokenInfo[6] as bigint) : BigInt(0); // Assuming data[6] contains the price
  const totalPrice = mintPrice * BigInt(amount || "1");

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
      <h1 className="text-2xl font-bold mb-6">ERC-1155 Token Minter</h1>

      {!isConnected ? (
        <div className="mb-6">
          <ConnectButton />
        </div>
      ) : (
        <div className="space-y-4">
          {/* <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Token ID
            </label>
            <input
              type="number"
              value={tokenId}
              onChange={(e) => setTokenId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              min="0"
            />
          </div> */}

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
            <div className="p-4 bg-gray-50 rounded-md space-y-2">
              <h3 className="font-medium">Token Info:</h3>
              <p>Name: {tokenInfo[0]}</p>
              <p>Description: {tokenInfo[1]}</p>
              <p>Price per token: {formatEther(mintPrice)} ETH</p>
              <p className="font-medium">
                Total price: {formatEther(totalPrice)} ETH
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
              : `Mint Tokens (${formatEther(totalPrice)} ETH)`}
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
