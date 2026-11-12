import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // TypeScript is replaced by tsc-rs (Rust port of the TS 7 compiler, see
  // package.json devDependencies -> "typescript": "npm:@tsc-rs/typescript").
  // The native compiler has no JS API, so Next's in-build type-check step
  // cannot use it. Type safety is enforced instead by the Rust toolchain:
  // `bun run lint` / `bun run typecheck` run the real compiler (tsc-rs).
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default withNextIntl(nextConfig);
