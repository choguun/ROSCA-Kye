import type { NextConfig } from "next";
import path from "path";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
  
    // Disable ESLint during builds for deployment
    eslint: {
        ignoreDuringBuilds: true,
    },
    
    // Disable TypeScript checking during builds for deployment
    typescript: {
        ignoreBuildErrors: true,
    },
    
    // Skip trailing slash redirect
    skipTrailingSlashRedirect: true,
    
    // Force all pages to be server-rendered
    trailingSlash: false,
    
    // Disable static optimization completely
    output: 'standalone',
    
    
    // Allow whitelisted domain for Dapp Portal
    allowedDevOrigins: [
        'joinkye.xyz',
    ],

    // Accept requests from custom domain
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    {
                        key: 'X-Custom-Header',
                        value: 'joinkye-proxy'
                    }
                ]
            }
        ]
    },

    webpack: (config) => {
        config.resolve.alias = {
            ...(config.resolve.alias || {}),
            '@': path.resolve(__dirname, 'src'),
        };
        config.resolve.extensions.push('.mjs');
        return config;
    },
};

export default withSentryConfig(
  nextConfig,
  {
    silent: true,
    org: "test-rvo",
    project: "javascript-nextjs",
  },
  {
    widenClientFileUpload: true,
    transpileClientSDK: true,
    tunnelRoute: "/monitoring",
    hideSourceMaps: true,
    disableLogger: true,
    automaticVercelMonitors: true,
  }
);
