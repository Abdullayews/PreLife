# ── Stage 1: build the release binary ──────────────────────────────────────
FROM rust:1-slim-bookworm AS builder
WORKDIR /app

# 1) Cache compiled dependencies: build a dummy crate first, then discard
#    only its source — Cargo keeps the compiled deps in target/, so the
#    expensive layer (tokio, axum, reqwest…) is reused on every code change.
COPY Cargo.toml Cargo.lock ./
RUN mkdir -p src && echo 'fn main() { println!("dependency-cache"); }' > src/main.rs \
    && cargo build --release && rm -rf src

# 2) Real source — only src/ changed, so the dependency layers above hit
#    the Docker build cache.
COPY src ./src
RUN touch src/main.rs && cargo build --release

# ── Stage 2: minimal runtime ───────────────────────────────────────────────
# The binary links only glibc (reqwest is built with rustls — no OpenSSL)
# and needs CA certificates for HTTPS calls to Supabase. Everything lives
# in memory, so the runtime user needs no writable paths.
FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --no-create-home prelife
WORKDIR /app
COPY --from=builder /app/target/release/prelife-api /usr/local/bin/prelife-api

# Render injects PORT (10000) for Docker services; prelife-api reads it
# from the environment (mini-services/prelife-api/src/config.rs).
ENV PORT=10000
EXPOSE 10000
USER prelife
ENTRYPOINT ["prelife-api"]
