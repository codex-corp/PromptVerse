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
        : {}),
    webpack: (config) => {
        // This is the crucial part for WSL live-reloading
        config.watchOptions = {
            poll: 1000, // Check for changes every second
            aggregateTimeout: 300, // Delay before rebuilding
        };
        return config;
    },
};

module.exports = nextConfig;
