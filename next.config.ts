import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
