import { useRouter } from "next/router";
import TokenMinter from "@/components/TokenMinter";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchTokenDetailFromAPI, TokenDetail } from "@/lib/api";
import { TokenMetadata } from "@/types";
import { CountdownTimer } from "@/components/CountdownTimer";
import Head from "next/head";
import DisplayName from "@/components/DisplayName";
import { BountySection } from "@/components/bounty/BountySection";

const getDisplayContent = (
  metadata: TokenMetadata | null,
  name: string
) => {
  if (
    metadata?.animation_url &&
    (metadata.animation_url.includes("html") ||
      metadata.animation_url.includes("htm"))
  ) {
    return (
      <iframe
        src={metadata.animation_url}
        className="w-full h-full"
        frameBorder="0"
        title={name}
      />
    );
  }
  if (
    metadata?.animation_url &&
    (metadata.animation_url.includes("mp4") ||
      metadata.animation_url.includes("webm"))
  ) {
    return (
      <video
        src={metadata.animation_url}
        autoPlay
        loop
        muted
        className="w-full"
      />
    );
  }

  // if metatadata?.image is ipfs://, fetch the image from ipfs
  if (metadata?.image && metadata?.image.includes("ipfs://")) {
    return (
      <img
        src={`https://ipfs.io/ipfs/${metadata.image.slice(7)}`}
        alt={name}
        className="w-full"
      />
    );
  }

  if (metadata?.image) {
    return <img src={metadata.image} alt={name} className="w-full" />;
  }

  return null;
};

export default function TokenPage() {
  const router = useRouter();
  const { contract, token } = router.query;
  const contractAddress = contract as `0x${string}`;
  const tokenId = token ? parseInt(token as string, 10) : 0;

  const [metadata, setMetadata] = useState<TokenMetadata | null>(null);

  // Fetch token data from API
  const {
    data: tokenData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["token", contractAddress, tokenId],
    queryFn: () => fetchTokenDetailFromAPI(contractAddress, tokenId),
    enabled: !!contractAddress && !!tokenId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch metadata from URI when token data is available
  useEffect(() => {
    if (!tokenData?.uri) return;

    let mounted = true;

    async function fetchMetadata() {
      try {
        let fetchUrl = tokenData!.uri!;
        if (fetchUrl.startsWith("ipfs://")) {
          fetchUrl = `https://ipfs.io/ipfs/${fetchUrl.slice(7)}`;
        }

        const response = await fetch(fetchUrl);
        if (!response.ok) return;

        const data = await response.json();
        if (mounted) {
          setMetadata(data);
        }
      } catch (err) {
        console.error("Error fetching metadata:", err);
      }
    }

    fetchMetadata();

    return () => {
      mounted = false;
    };
  }, [tokenData?.uri]);

  if (!contractAddress || !tokenId) {
    return (
      <div className="px-4 lg:px-8 text-[12px] xl:px-12 py-4 opacity-60 w-full text-center">
        Invalid token URL
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="px-4 lg:px-8 text-[12px] xl:px-12 py-4 opacity-60 w-full text-center">
        Loading token data...
      </div>
    );
  }

  if (error || !tokenData) {
    return (
      <div className="px-4 lg:px-8 text-[12px] xl:px-12 py-4 opacity-60 w-full text-center">
        Error: {error?.message || "Token not found"}
      </div>
    );
  }

  const displayContent = getDisplayContent(metadata, tokenData.name);
  const now = Math.floor(Date.now() / 1000);
  const isMintActive = tokenData.mintOpenUntil > now;
  const closeDate = new Date(tokenData.mintOpenUntil * 1000);

  return (
    <>
      <Head>
        <title>{tokenData.name} | Nodeworks</title>
        <meta name="description" content={metadata?.description || tokenData.description} />
        <meta property="og:title" content={`${tokenData.name} | Nodeworks`} />
        <meta property="og:description" content={metadata?.description || tokenData.description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://nodeworks.art" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:site" content="@ripe0x" />
        <meta name="twitter:title" content={`${tokenData.name} | Nodeworks`} />
        <meta name="twitter:description" content={metadata?.description || tokenData.description} />
        <link rel="icon" href="/networkednodes_black.svg" />
      </Head>
      <div className="px-4 lg:px-8 xl:px-12 py-0 w-full">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="lg:w-2/3">
            <div className="w-full aspect-square">{displayContent}</div>
          </div>

          <div className="lg:w-1/3">
            <div className="mb-2">
              <h1 className="text-md">{metadata?.name || tokenData.name}</h1>
              <p className="text-[12px] opacity-80">
                By{" "}
                <a
                  href={`https://networked.art/${tokenData.deployerAddress}/${contractAddress}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold underline hover:no-underline"
                >
                  <DisplayName address={tokenData.deployerAddress} cachedName={tokenData.deployerEnsName} />
                </a>
              </p>
            </div>

            <p className="text-[12px] opacity-70">{metadata?.description || tokenData.description}</p>
            <hr className="my-4" />
            <div className="text-[12px] mt-4 mb-2">
              {isMintActive ? (
                <CountdownTimer
                  closeAt={tokenData.mintOpenUntil}
                  totalMinted={tokenData.totalMinted}
                />
              ) : (
                <div className="flex justify-between">
                  <p className="text-[12px] opacity-60">
                    {tokenData.totalMinted.toLocaleString()} minted
                  </p>
                  <p className="text-[12px] opacity-60 text-end">
                    closed on {closeDate.toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
            {isMintActive && (
              <TokenMinter
                contractAddress={contractAddress}
                tokenId={tokenId}
              />
            )}

            {/* Bounty Section */}
            <BountySection
              tokenContract={contractAddress}
              tokenId={tokenId}
            />

            <hr className="my-4" />
            <div className="mt-4">
              <div className="space-y-3">
                {tokenData.mintHistory.map((event, i) => (
                  <a
                    key={i}
                    className="flex justify-between items-center text-[12px] opacity-70 hover:opacity-90"
                    href={`https://etherscan.io/tx/${event.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <div>
                      <DisplayName address={event.minter} cachedName={event.minterEnsName} />
                      <span className="text-gray-500 ml-2">
                        {event.amount}×
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-gray-500">
                        {new Date(event.timestamp * 1000).toLocaleString()}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
