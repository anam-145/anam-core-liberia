/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["typeorm", "reflect-metadata"],
  },
  webpack: (config) => {
    // TypeORM 설정
    config.module.rules.push({
      test: /\.node$/,
      loader: "node-loader",
    });

    return config;
  },
};

export default nextConfig;