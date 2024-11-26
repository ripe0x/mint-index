import React from "react";

export const Footer = () => {
  return (
    <div className="mt-4 xl:mt-8 px-4 lg:px-8 xl:px-12 py-4 border-t border-gray-200 border-solid w-full leading-tight">
      <p className="text-[12px] opacity-60 font-thin mt-1">
        permissionless front-end by{" "}
        <a
          href="https://twitter.com/ripe0x"
          target="_blank"
          rel="noreferrer"
          className="font-bold underline hover:no-underline"
        >
          ripe
        </a>
        . logo by{" "}
        <a
          href="https://x.com/rotter_daniel"
          target="_blank"
          rel="noreferrer"
          className="font-bold underline hover:no-underline"
        >
          daniel rotter
        </a>
      </p>
    </div>
  );
};
