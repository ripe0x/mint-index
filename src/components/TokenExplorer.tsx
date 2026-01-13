import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchTokensFromAPI, TokenInfo } from "@/lib/api";
import { Token } from "./Token";
import { useErrorHandler } from "@/app/utils/errors";

const TokenExplorer = () => {
  const [displayedTokens, setDisplayedTokens] = useState<number>(30);
  const [allLoaded, setAllLoaded] = useState(false);
  const { error: handlerError, handleError } = useErrorHandler();
  const observerTarget = React.useRef<HTMLDivElement>(null);

  const {
    data: tokens = [],
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: ["tokens"],
    queryFn: fetchTokensFromAPI,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Handle query errors
  useEffect(() => {
    if (queryError) {
      handleError(queryError);
    }
  }, [queryError, handleError]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && !allLoaded) {
          setDisplayedTokens((prev) => {
            const next = prev + 30;
            if (next >= tokens.length) {
              setAllLoaded(true);
            }
            return next;
          });
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [loading, allLoaded, tokens.length]);

  // Reset allLoaded when tokens change
  useEffect(() => {
    if (tokens.length > 0 && displayedTokens >= tokens.length) {
      setAllLoaded(true);
    } else {
      setAllLoaded(false);
    }
  }, [tokens.length, displayedTokens]);

  if (loading)
    return (
      <div className="px-4 lg:px-8 text-xs xl:px-12 py-4 opacity-60 w-full">
        Loading all tokens...
      </div>
    );
  if (handlerError)
    return (
      <div className="px-4 lg:px-8 text-xs xl:px-12 py-4 opacity-60 w-full">
        Error: {handlerError}
      </div>
    );

  return (
    <div className="px-4 lg:px-8 xl:px-12 py-0 w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 lg:gap-8 xl:gap-16 w-full">
        {tokens.slice(0, displayedTokens).map((token) => (
          <div
            key={`${token.contractAddress}-${token.tokenId}`}
            className="w-full min-h-60"
          >
            <Token
              contractAddress={token.contractAddress}
              tokenId={token.tokenId}
              deployerAddress={token.deployerAddress}
              cachedData={{
                name: token.name,
                description: token.description,
                mintedBlock: token.mintedBlock,
                closeAt: token.closeAt,
                mintOpenUntil: token.mintOpenUntil,
                totalMinted: token.totalMinted,
                uri: token.uri,
                metadata: token.metadata,
              }}
            />
          </div>
        ))}
      </div>
      {!loading && !allLoaded && (
        <div
          ref={observerTarget}
          className="w-full h-20 flex items-center justify-center text-xs opacity-60"
        >
          Loading more tokens...
        </div>
      )}
      {allLoaded && tokens.length > 0 && (
        <div className="w-full h-20 flex items-center justify-center text-xs opacity-60">
          All tokens loaded
        </div>
      )}
    </div>
  );
};

export default TokenExplorer;
