import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // add image hostname
  images: {
    domains: ["ipfs.io"],
  },
};

export default nextConfig;
