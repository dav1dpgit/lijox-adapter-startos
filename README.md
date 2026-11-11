# LIJOX Adapter for StartOS

The [LIJOX adapter](https://github.com/dav1dpgit/lijox-lnd-adapter) as a StartOS service (`.s9pk`). A Start9 server
running LND becomes a LIJOX Lightning service provider: wallets that speak the LIJOX standard (LiJ and others) open
channels with it, receive while offline, and keep their Black start kits with it. Nothing runs on a second machine.

It runs beside **LND (Terminus)** ([lnd-startos-terminus](https://github.com/dav1dpgit/lnd-startos-terminus)):
Start9's LND package with one patch, which opens the zero-conf channels without anchors that LIJOX wallets ask for.

**Status: first release, not yet run on an operator's server.** Install it with the publisher on a call.

## Download

[Releases](../../releases): `lijox-adapter_x86_64.s9pk` for Intel/AMD servers, `lijox-adapter_aarch64.s9pk` for ARM,
and `SHA256SUMS` with each file's fingerprint. Check your file before installing:

- Windows (PowerShell): `Get-FileHash .\lijox-adapter_x86_64.s9pk -Algorithm SHA256`
- Mac / Linux: `shasum -a 256 lijox-adapter_x86_64.s9pk`

## Install

StartOS 0.4.0.2 or later, with LND (Terminus) installed and running. StartOS → **Sideload** → the `.s9pk`. Then follow
[instructions.md](instructions.md) (the same text StartOS shows on the service's page).

## What the package does

- **Image** (`Dockerfile`): Node 22 with the adapter at one pinned commit of the public adapter repository — the build
  stops if any file differs from `adapter-release.sha256` — plus `lncli` and `cloudflared` (Cloudflare's release
  binary, checked against its published SHA-256).
- **LND**: mounts LND's volume read-only and finds gRPC, REST and the peer port on StartOS's internal network at every
  start. The **LND (Terminus)** health check reads LND's version line and turns red when Start9's stock LND is
  installed instead.
- **Macaroons** (`docker/prepare.js`): bakes the adapter's own least-privilege macaroon and a CloseChannel-only one
  for `lncli`, under a root key id of its own; bakes again by itself when a release changes the permission list.
- **Settings**: *Start here* — node name (from LND's alias), the public HTTPS and WSS addresses, a Cloudflare tunnel
  token, and the on-chain reserve (the operator's own number; LND's on-chain balance is shown beside it). Then the way
  in, the LIJOX registries, fees, limits, the lease and the offline hold, Mix pools.
- **Made at install, never typed**: the route token, the console's TOTP secret, the wake-push key pair.
- **Interfaces**: API (7000), WebSocket (7001), Console (7004, TOTP login — keep it on the local network).
- **What it reaches out to**: LND on the same server; the LIJOX registries set; a price feed; wallet vendors' push
  services; Cloudflare when the tunnel is on. No telemetry, no update checks.

## Build

`.github/workflows/release.yml` builds both architectures with Start9's shared build workflow and publishes them as a
release. Locally: `npm ci`, then `make` (needs Docker and `start-cli`). Each CI build is signed with a one-time key.

Security reports: dp@modulo.network. License: MIT.
