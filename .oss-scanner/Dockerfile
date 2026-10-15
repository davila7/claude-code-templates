# Build image for Anthropic's OSS Scanner (https://github.com/anthropics/oss-scanner).
# The scanner builds this with the repository as context, then removes network access,
# so every dependency the CLI, the dashboard API and the Rust core need is fetched here.
FROM node:22-bookworm

ENV DEBIAN_FRONTEND=noninteractive \
    CARGO_HOME=/opt/cargo \
    RUSTUP_HOME=/opt/rustup \
    PATH=/opt/cargo/bin:$PATH \
    CI=true \
    CCT_NO_TRACKING=true \
    CCT_NO_ANALYTICS=true

# node:22-bookworm is the full Debian image: git, curl, python3 and a C toolchain
# are already present.
RUN curl -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain stable

# scanner contract: the checkout lives inside the image, at /src
COPY . /src
WORKDIR /src

# Node CLI (the npm package `claude-code-templates`). The repo's .npmrc sets
# ignore-scripts=true; keep it that way.
RUN cd /src/cli-tool && npm ci --no-audit --no-fund

# Dashboard (aitmpl.com) and its API routes. Dependencies only: a production
# build needs Cloudflare/Clerk variables the scanner does not have.
RUN cd /src/dashboard && npm ci --no-audit --no-fund

# Rust port of the installer core, built and tests compiled while online.
RUN cd /src/cli-rust && cargo build --locked && cargo test --locked --no-run

# Smoke-test the CLI and run the suites without failing the build: the cli-tool
# Jest suite has known failures unrelated to security.
RUN node /src/cli-tool/bin/create-claude-config.js --help >/dev/null
RUN cd /src/cli-tool && (npx jest --ci --silent --coverage=false || echo "WARNING: jest reported failures")
RUN cd /src/cli-rust && (cargo test --locked || echo "WARNING: cargo test reported failures")
