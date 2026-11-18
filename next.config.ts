import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
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
