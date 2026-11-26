# LIJOX Adapter for StartOS — the adapter at one commit of the PUBLIC adapter repo (an externally deployed package
# builds from the public mirror — DP, 2026-10-27), LND's lncli, and cloudflared.
#
# ADAPTER_VERSION and ADAPTER_COMMIT must match the first line of adapter-release.sha256 (scripts/pin-adapter.sh writes
# the list and the line); the build stops when any file at the commit differs from the list. The commit is fetched, not
# a tag: a tag can be moved.
ARG ADAPTER_VERSION=v0.146.0
ARG ADAPTER_COMMIT=cf25d62d3f03b41a696ed3b82fa98e35ee188cf0
ARG CLOUDFLARED_VERSION=2026.10.0

# lncli for the lease's and recover-close's channel close (the stock binary of the LND release LND (Terminus) is
# built from; the patch changes nothing lncli does)
FROM lightninglabs/lnd:v0.21.5-beta AS lnd

# cloudflared, the tunnel — Cloudflare's release binary, checked against its published SHA-256
FROM alpine:3.22 AS cloudflared
ARG CLOUDFLARED_VERSION
ARG TARGETARCH
RUN apk add --no-cache curl
RUN case "${TARGETARCH}" in \
      amd64) SUM=d33ff2d14475178d2012c2c56beba87389ac5ded27649519f198a7d3134a99db ;; \
      arm64) SUM=e6422b9d4f72d3194bc5a38676f13667c06666523217b842a877d72a80b5ac08 ;; \
      *) echo "no cloudflared for ${TARGETARCH}" >&2; exit 1 ;; \
    esac \
 && curl -fsSL -o /cloudflared "https://github.com/cloudflare/cloudflared/releases/download/${CLOUDFLARED_VERSION}/cloudflared-linux-${TARGETARCH}" \
 && echo "${SUM}  /cloudflared" | sha256sum -c - \
 && chmod 0755 /cloudflared

# the adapter at the pinned commit, hash-checked, with its packages installed
FROM node:22-alpine AS adapter
ARG ADAPTER_VERSION
ARG ADAPTER_COMMIT
RUN apk add --no-cache git python3 make g++
RUN git init -q /opt/lijox-adapter \
 && git -C /opt/lijox-adapter fetch -q --depth 1 https://github.com/dav1dpgit/lijox-lnd-adapter "${ADAPTER_COMMIT}" \
 && git -C /opt/lijox-adapter -c advice.detachedHead=false checkout -q FETCH_HEAD
COPY adapter-release.sha256 /opt/adapter-release.sha256
RUN head -1 /opt/adapter-release.sha256 | grep -qx "# ${ADAPTER_VERSION} ${ADAPTER_COMMIT}" \
 && cd /opt/lijox-adapter \
 && grep -v '^#' /opt/adapter-release.sha256 | sha256sum -c - \
 && npm ci --omit=dev \
 && rm -rf .git

FROM node:22-alpine
COPY --from=adapter /opt/lijox-adapter /opt/lijox-adapter
COPY --from=lnd /bin/lncli /usr/local/bin/lncli
COPY --from=cloudflared /cloudflared /usr/local/bin/cloudflared
COPY docker/ /opt/lijox-start9/
RUN chmod 0755 /opt/lijox-start9/run-adapter.sh \
 && lncli --version \
 && cloudflared --version \
 && node -e "require('/opt/lijox-adapter/node_modules/secp256k1'); require('/opt/lijox-adapter/node_modules/better-sqlite3')"
WORKDIR /opt/lijox-adapter
