import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Config options here
  images: {
    domains: ["ipfs.io"],
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "mint-index.netlify.app",
          },
        ],
        destination: "https://nodeworks.art/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "nodeworks.art",
          },
        ],
        destination: "https://nodeworks.art/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
