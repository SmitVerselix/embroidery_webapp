import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';
// Define the base Next.js configuration
const baseConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.slingacademy.com',
        port: ''
      },
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
        port: ''
      },
      {
        protocol: 'https',
        hostname: 'clerk.com',
        port: ''
      },
      {
        protocol: 'https',
        hostname: 'embroidery.nyc3.digitaloceanspaces.com',
        port: ''
      }
    ]
  },
  transpilePackages: ['geist'],

  // Proxy external image storage through the Next.js server so that
  // client-side code (e.g. jsPDF PDF generation) can fetch images
  // without being blocked by CORS.
  //
  // How it works:
  //   Browser fetches  /image-proxy/embroidery/embroidery/abc.png
  //   Next.js rewrites → https://embroidery.nyc3.digitaloceanspaces.com/embroidery/embroidery/abc.png
  //   Response is returned to the browser as same-origin → no CORS issue.
  //
  // To add more storage domains, add another entry here AND a matching
  // entry in IMAGE_PROXY_MAP inside order-template-pdf.tsx.
  async rewrites() {
    return [
      {
        source: '/image-proxy/:path*',
        destination: 'https://embroidery.nyc3.digitaloceanspaces.com/:path*'
      }
    ];
  }
};
let configWithPlugins = baseConfig;
// Conditionally enable Sentry configuration
if (!process.env.NEXT_PUBLIC_SENTRY_DISABLED) {
  configWithPlugins = withSentryConfig(configWithPlugins, {
    // For all available options, see:
    // https://www.npmjs.com/package/@sentry/webpack-plugin#options
    // FIXME: Add your Sentry organization and project names
    org: process.env.NEXT_PUBLIC_SENTRY_ORG,
    project: process.env.NEXT_PUBLIC_SENTRY_PROJECT,
    // Only print logs for uploading source maps in CI
    silent: !process.env.CI,
    // For all available options, see:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
    // Upload a larger set of source maps for prettier stack traces (increases build time)
    widenClientFileUpload: true,
    // Upload a larger set of source maps for prettier stack traces (increases build time)
    reactComponentAnnotation: {
      enabled: true
    },
    // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
    // This can increase your server load as well as your hosting bill.
    // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
    // side errors will fail.
    tunnelRoute: '/monitoring',
    // Automatically tree-shake Sentry logger statements to reduce bundle size
    disableLogger: true,
    // Disable Sentry telemetry
    telemetry: false
  });
}
const nextConfig = configWithPlugins;
export default nextConfig;
