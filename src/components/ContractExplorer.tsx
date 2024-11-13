import React, { useEffect, useState } from "react";
import { fetchFactoryEvents } from "@/lib/fetchFactoryEvents";
import { Address } from "viem";
import { Contract } from "./Contract";
import { useErrorHandler } from "@/app/utils/errors";

type Contract = {
  owner: Address | undefined;
  contractAddress: Address | undefined;
  blockNumber: number;
};

const ContractExplorer = () => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const { error, handleError } = useErrorHandler();

  useEffect(() => {
    async function getEvents() {
      try {
        setLoading(true);
        const results = await fetchFactoryEvents();
        const contractCreations = results.createdEvents.map((log) => ({
          owner: log.args.ownerAddress,
          contractAddress: log.args.contractAddress,
          blockNumber: Number(log.blockNumber),
        }));

        setContracts(contractCreations.reverse());

        setLoading(false);
      } catch (err) {
        handleError(err);
      }
    }

    getEvents();
  }, [handleError]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div>
      <div className="p-4">
        {contracts.map((contract) => (
          <Contract
            key={contract.contractAddress}
            contractAddress={contract.contractAddress as Address}
            deployerAddress={contract.owner as Address}
          />
        ))}
      </div>
    </div>
  );
};

export default ContractExplorer;
