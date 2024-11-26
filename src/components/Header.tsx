import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import React from "react";

const Header = () => {
  return (
    <div className="px-4 lg:px-8 xl:px-12 py-4 2xl:py-8 w-full leading-tight flex flex-col sm:flex-row gap-2 sm:justify-between">
      <div className="flex flex-row gap-2 items-center">
        <Link href="/">
          <img
            src="/networkednodes_black.svg"
            alt="Networked Nodes"
            className="w-14 h-14"
          />
        </Link>
        <div>
          <Link href="/">
            <h1 className="text-md text-gray-800 font-bold">Networked Nodes</h1>
          </Link>
          <p className="text-[12px] opacity-60 font-thin mt-1">
            explore the latest creations on{" "}
            <a
              href="https://docs.mint.vv.xyz/"
              target="_blank"
              rel="noreferrer"
              className="font-bold underline hover:no-underline"
            >
              mint protocol
            </a>
          </p>
        </div>
      </div>
      <div id="connectButtonWrapper" className="flex justify-center sm:block">
        <ConnectButton showBalance={false} label="Connect" />
      </div>
    </div>
  );
};

export default Header;
