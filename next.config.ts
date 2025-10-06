
import type { NextConfig } from "next";

const isGithubPages = process.env.NEXT_DEPLOY_TARGET === "github-pages";
const derivedRepoName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const basePathOverride = process.env.NEXT_PUBLIC_BASE_PATH;
const basePath = isGithubPages
    ? basePathOverride ?? (derivedRepoName ? `/${derivedRepoName}` : "")
    : basePathOverride ?? "";

const nextConfig: NextConfig = {
    ...(isGithubPages
        ? {
            output: "export" as const,
            images: { unoptimized: true },
            basePath: basePath || undefined,
            assetPrefix: basePath ? `${basePath}/` : undefined,
        }
        : {
            // Default for Cloudflare
            images: { unoptimized: true },
        }),
    webpack: (config, { isServer }) => {
        // Exclude Node.js modules from edge runtime
        if (!isServer) {
            config.resolve.fallback = {
                ...config.resolve.fallback,
                fs: false,
                net: false,
                tls: false,
                crypto: false,
                async_hooks: false,
            };
        }

        config.watchOptions = {
            poll: 1000,
            aggregateTimeout: 300,
        };

        return config;
    },
};

export default nextConfig;
