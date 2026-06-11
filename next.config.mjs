/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["xlsx"]
  },
  async rewrites() {
    return [
      {
        source: "/.well-known/agent-card.json",
        destination: "/api/agent-card"
      }
    ];
  }
};

export default nextConfig;
