/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Prisma + stellar sdk are server-only; keep them external on the server bundle.
  serverExternalPackages: ["@prisma/client", "@stellar/stellar-sdk"],
  webpack: (config) => {
    // @privy-io/react-auth optionally references packages for features we don't use
    // (Farcaster/Solana login, Stripe crypto onramp). Alias the missing ones to empty modules
    // so the client bundle builds instead of failing with "Can't resolve '…'".
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@farcaster/mini-app-solana": false,
      "@stripe/crypto": false,
    };
    return config;
  },
};
export default nextConfig;
