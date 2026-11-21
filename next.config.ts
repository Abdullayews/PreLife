import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isProd = process.env.NODE_ENV === "production";

/* v5.2 (loop iter 3, security round): baseline security headers.
 * - CSP allows only self + Unsplash images (seed content) + data:/blob:
 *   (avatars are data-URI validated server-side); Next's inline hydration
 *   scripts/styles need 'unsafe-inline'; dev (Turbopack HMR) also needs
 *   'unsafe-eval' + ws:.
 * - Frame protection ships PRODUCTION-ONLY: the sandbox preview panel
 *   iframes this app from a *.space-z.ai origin — X-Frame-Options /
 *   frame-ancestors there would blank the preview. */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://images.unsplash.com",
  "font-src 'self' data:",
  `connect-src 'self'${isProd ? "" : " ws:"}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  ...(isProd ? ["frame-ancestors 'none'"] : []),
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: csp },
  ...(isProd ? [{ key: "X-Frame-Options", value: "DENY" }] : []),
];

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // DEV ONLY: the browser-facing /api/* calls (lib/api-url.ts appends the
  // XTransformPort=3030 gateway param) are routed by the space-z.ai preview
  // gateway — which does not exist on a plain localhost:3000 visit. This
  // rewrite bridges that gap for local E2E (agent-browser, curl). Production
  // (next start / NODE_ENV=production) leaves /api/* to the edge proxy
  // exactly as before.
  ...(process.env.NODE_ENV !== "production"
    ? {
        async rewrites() {
          return [
            {
              source: "/api/:path*",
              destination: `${process.env.API_INTERNAL_URL ?? "http://127.0.0.1:3030"}/api/:path*`,
            },
            {
              source: "/internal/:path*",
              destination: `${process.env.API_INTERNAL_URL ?? "http://127.0.0.1:3030"}/internal/:path*`,
            },
          ];
        },
      }
    : {}),
  // Sandbox↔Render parity: `next dev` ships a floating "Next.js dev tools"
  // badge (bottom-left) plus route-compile spinners. None of that exists in
  // the production build served on Render, so the preview panel looked
  // different from the live site. Turning the indicators off makes the
  // dev sandbox render pixel-identical chrome to production.
  devIndicators: false,
  // The sandbox preview panel serves the app from a *.space-z.ai host.
  // Without this, Next.js dev (16) blocks cross-origin requests to dev
  // resources (e.g. /__nextjs_original-stack-frames) from that origin.
  // 127.0.0.1/localhost: local verification (agent-browser, curl) — without
  // them the dev server blocks /_next/hmr for these hosts, which silently
  // breaks client hydration on locally-opened pages.
  allowedDevOrigins: ["*.space-z.ai", "localhost", "127.0.0.1"],
  // TypeScript is replaced by tsc-rs (Rust port of the TS 7 compiler, see
  // package.json devDependencies -> "typescript": "npm:@tsc-rs/typescript").
  // The native compiler has no JS API, so Next's in-build type-check step
  // cannot use it. Type safety is enforced instead by the Rust toolchain:
  // `bun run lint` / `bun run typecheck` run the real compiler (tsc-rs).
  typescript: {
    ignoreBuildErrors: true,
    // Next reads the npm version of the "typescript" package (0.8.0 for the
    // tsc-rs alias), assumes a pre-5.0 compiler and rewrites the root
    // tsconfig's moduleResolution to "node" on every dev/build start — which
    // tsc-rs rejects (node10 resolution was removed in TS 7). Point Next at
    // this sacrificial config instead; the root tsconfig.json stays under
    // the Rust toolchain's control.
    tsconfigPath: "./tsconfig.next.json",
  },
};

export default withNextIntl(nextConfig);
