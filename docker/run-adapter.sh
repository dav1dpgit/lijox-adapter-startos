#!/bin/sh
# Start the adapter with the macaroon and node identity the prepare step wrote (kept in files, not in the
# environment StartOS stores).
set -eu
K=/data/lnd-keys
if [ ! -s "$K/adapter.hex" ] || [ ! -s "$K/identity.json" ]; then
  echo "LIJOX: the prepare step did not finish (no adapter macaroon or node identity in $K)." >&2
  exit 1
fi
LIJ_ADAPTER_MACAROON_HEX="$(cat "$K/adapter.hex")"
NODE_PUBKEY="$(node -e 'process.stdout.write(String(require(process.argv[1]).pubkey || ""))' "$K/identity.json")"
NODE_HOST="$(node -e 'process.stdout.write(String(require(process.argv[1]).host || ""))' "$K/identity.json")"
if [ -z "$NODE_HOST" ]; then
  echo "LIJOX: LND advertises no public peer address. Install Tor (LND then advertises an onion address) or set" >&2
  echo "       'Public peer address' in the adapter's Settings." >&2
  exit 1
fi
export LIJ_ADAPTER_MACAROON_HEX NODE_PUBKEY NODE_HOST
mkdir -p "$LIJ_DATA_DIR"
cd /opt/lijox-adapter
exec node lij-adapter.js
