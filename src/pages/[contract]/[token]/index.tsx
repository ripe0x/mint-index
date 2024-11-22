import { useRouter } from "next/router";
import { useReadContract, useBlock } from "wagmi";
import { abi1155 } from "@/abi/abi1155";
import { formatEther, parseAbiItem } from "viem";
import TokenMinter from "@/components/TokenMinter";
import { useEffect, useMemo, useState } from "react";
import { client, clientSepolia } from "@/config";
import DisplayName from "@/components/DisplayName";
import { useErrorHandler } from "@/app/utils/errors";
import { TokenData, TokenMetadata } from "@/types";

type MintEvent = {
  address: string;
  amount: number;
  price: bigint;
  timestamp: number;
};

export default function TokenPage() {
  const router = useRouter();
  console.log("router", router);
  const { contract, token } = router.query;
  let contractAddress = contract as `0x${string}`;
  let tokenId = token as string;

  console.log("contractAddress", contractAddress);
  console.log("tokenId", tokenId);
  const [mintHistory, setMintHistory] = useState<MintEvent[]>([]);
  const [baseFee, setBaseFee] = useState<bigint>(BigInt(0));

  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [metadata, setMetadata] = useState<TokenMetadata | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const { error, handleError } = useErrorHandler();
  const [totalMinted, setTotalMinted] = useState<number>(0);

  const rendererabi = [
    { inputs: [], name: "AmountTooLarge", type: "error" },
    {
      inputs: [
        { internalType: "uint256", name: "tokenId", type: "uint256" },
        {
          components: [
            { internalType: "string", name: "name", type: "string" },
            { internalType: "string", name: "description", type: "string" },
            { internalType: "address[]", name: "artifact", type: "address[]" },
            { internalType: "uint32", name: "renderer", type: "uint32" },
            { internalType: "uint32", name: "mintedBlock", type: "uint32" },
            { internalType: "uint64", name: "closeAt", type: "uint64" },
            { internalType: "uint128", name: "data", type: "uint128" },
          ],
          internalType: "struct Token",
          name: "token",
          type: "tuple",
        },
      ],
      name: "animationURI",
      outputs: [{ internalType: "string", name: "", type: "string" }],
      stateMutability: "pure",
      type: "function",
    },
    {
      inputs: [
        { internalType: "uint256", name: "tokenId", type: "uint256" },
        {
          components: [
            { internalType: "string", name: "name", type: "string" },
            { internalType: "string", name: "description", type: "string" },
            { internalType: "address[]", name: "artifact", type: "address[]" },
            { internalType: "uint32", name: "renderer", type: "uint32" },
            { internalType: "uint32", name: "mintedBlock", type: "uint32" },
            { internalType: "uint64", name: "closeAt", type: "uint64" },
            { internalType: "uint128", name: "data", type: "uint128" },
          ],
          internalType: "struct Token",
          name: "token",
          type: "tuple",
        },
      ],
      name: "generateSVG",
      outputs: [{ internalType: "string", name: "", type: "string" }],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [
        { internalType: "uint256", name: "tokenId", type: "uint256" },
        {
          components: [
            { internalType: "string", name: "name", type: "string" },
            { internalType: "string", name: "description", type: "string" },
            { internalType: "address[]", name: "artifact", type: "address[]" },
            { internalType: "uint32", name: "renderer", type: "uint32" },
            { internalType: "uint32", name: "mintedBlock", type: "uint32" },
            { internalType: "uint64", name: "closeAt", type: "uint64" },
            { internalType: "uint128", name: "data", type: "uint128" },
          ],
          internalType: "struct Token",
          name: "token",
          type: "tuple",
        },
      ],
      name: "imageURI",
      outputs: [{ internalType: "string", name: "", type: "string" }],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "name",
      outputs: [{ internalType: "string", name: "", type: "string" }],
      stateMutability: "pure",
      type: "function",
    },
    {
      inputs: [
        { internalType: "uint256", name: "tokenId", type: "uint256" },
        {
          components: [
            { internalType: "string", name: "name", type: "string" },
            { internalType: "string", name: "description", type: "string" },
            { internalType: "address[]", name: "artifact", type: "address[]" },
            { internalType: "uint32", name: "renderer", type: "uint32" },
            { internalType: "uint32", name: "mintedBlock", type: "uint32" },
            { internalType: "uint64", name: "closeAt", type: "uint64" },
            { internalType: "uint128", name: "data", type: "uint128" },
          ],
          internalType: "struct Token",
          name: "token",
          type: "tuple",
        },
      ],
      name: "uri",
      outputs: [{ internalType: "string", name: "", type: "string" }],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "version",
      outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
      stateMutability: "pure",
      type: "function",
    },
  ];

  // Memoize the token identifier to prevent unnecessary re-fetches
  const tokenIdentifier = useMemo(
    () => `${contractAddress}-${tokenId}`,
    [contractAddress, tokenId]
  );

  useEffect(() => {
    let mounted = true;

    async function fetchTokenData() {
      if (!mounted || !contractAddress || !tokenId) return;

      try {
        const baseFee = await clientSepolia.getBlock({
          blockTag: "latest",
        });
        const blockNumber = baseFee.number;
        console.log("Current block number:", blockNumber);
        console.log("Current base fee:", baseFee.baseFeePerGas);

        // Get token details
        const details = await clientSepolia.readContract({
          address: contractAddress,
          abi: abi1155,
          functionName: "get",
          args: [BigInt(tokenId)],
        });

        if (!mounted) return;

        const block = await clientSepolia.getBlock({
          blockNumber: BigInt(blockNumber),
        });
        console.log("Base fee:", block.baseFeePerGas);
        // Get token URI
        // const tokenUri = await clientSepolia.readContract({
        //   address: contractAddress,
        //   abi: abi1155,
        //   functionName: "uri",
        //   args: [BigInt(tokenId)],
        //   blockNumber: blockNumber,
        // });
        // console.log("details", details);
        // console.log("tokenUri", tokenUri);

        // const blockNumber = BigInt(7130700);
        // const block = await clientSepolia.getBlock({ blockNumber });

        const tokenUri = await clientSepolia.readContract({
          address: contractAddress,
          abi: abi1155,
          functionName: "uri",
          args: [BigInt(tokenId)],
          blockNumber,
          // @ts-ignore
          gasPrice: block.baseFeePerGas,
        });

        // const generateSVG = await clientSepolia.readContract({
        //   address:
        //     "0x9A821E095170Bf2E9Fa5A03a2Bb215236aadF1F9" as `0x${string}`,
        //   abi: rendererabi,
        //   functionName: "uri",
        //   args: [BigInt(tokenId), details],
        //   blockNumber: blockNumber,
        // });
        // console.log("generateSVG", generateSVG);

        if (!mounted) return;

        // Check mint status
        const mintOpenUntil = await clientSepolia.readContract({
          address: contractAddress,
          abi: abi1155,
          functionName: "mintOpenUntil",
          args: [BigInt(tokenId)],
        });

        if (!mounted) return;

        const data = {
          name: details[0],
          description: details[1],
          mintedBlock: Number(details[4]),
          closeAt: Number(details[5]),
          mintOpenUntil: Number(mintOpenUntil),
        };

        setTokenData(data);

        // Fetch metadata separately
        try {
          const response = await fetch(tokenUri);
          const metadata = await response.json();
          if (mounted) {
            setMetadata(metadata);
          }
        } catch (err) {
          handleError(err);
        }

        if (mounted) {
          setLoading(false);
        }
      } catch (err) {
        handleError(err);
        if (mounted) {
          setLoading(false);
        }
      }
    }

    setLoading(true);
    fetchTokenData();

    return () => {
      mounted = false;
    };
  }, [tokenIdentifier, handleError, contractAddress, tokenId]);

  if (!tokenData) return <div>Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="lg:w-2/3">
          <img
            src={metadata?.image}
            alt={metadata?.name}
            className="w-full rounded-lg"
          />
        </div>

        <div className="lg:w-1/3 space-y-6">
          <div>
            <h1 className="text-2xl font-bold">
              {metadata?.name || tokenData.name}
            </h1>
            <p className="text-gray-600">
              {/* By <DisplayName address={tokenInfo.data[3]} /> */}
            </p>
          </div>

          <p className="text-gray-700">{metadata?.description}</p>

          <div className="bg-gray-100 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Cost to mint</p>
            <p className="text-xl font-medium">{formatEther(baseFee)} ETH</p>
          </div>

          <TokenMinter
            contractAddress={contractAddress as `0x${string}`}
            tokenId={Number(tokenId)}
          />

          <div className="mt-8">
            <h2 className="text-lg font-bold mb-4">Mint Timeline</h2>
            <div className="space-y-3">
              {mintHistory.map((event, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center text-sm"
                >
                  <div>
                    {/* <DisplayName address={event.address} /> */}
                    <span className="text-gray-500 ml-2">{event.amount}×</span>
                  </div>
                  <div className="text-right">
                    <div>{formatEther(event.price)} ETH</div>
                    <div className="text-gray-500">
                      {new Date(event.timestamp * 1000).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
