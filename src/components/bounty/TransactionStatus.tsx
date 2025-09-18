import React from "react";
import { Hash } from "viem";

interface TransactionStatusProps {
  status: "idle" | "confirming" | "processing" | "success" | "error";
  hash?: Hash;
  error?: string;
  successMessage?: string;
}

export const TransactionStatus: React.FC<TransactionStatusProps> = ({
  status,
  hash,
  error,
  successMessage,
}) => {
  if (status === "idle") return null;

  return (
    <div className="mt-4 p-3 border rounded text-sm">
      {status === "confirming" && (
        <div className="text-gray-600">
          Confirm in wallet...
        </div>
      )}

      {status === "processing" && (
        <div className="flex items-center gap-2 text-blue-600">
          <span className="inline-block animate-spin">⏳</span>
          <span>Processing transaction...</span>
        </div>
      )}

      {status === "success" && (
        <div className="text-green-600">
          <div>{successMessage || "Transaction successful!"}</div>
          {hash && (
            <a
              href={`https://etherscan.io/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:no-underline mt-1 inline-block"
            >
              View on Etherscan →
            </a>
          )}
        </div>
      )}

      {status === "error" && (
        <div className="text-red-600">
          {error || "Transaction failed. Please try again."}
        </div>
      )}
    </div>
  );
};