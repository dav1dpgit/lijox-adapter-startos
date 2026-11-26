# LIJOX Adapter

Makes this server's LND a LIJOX Lightning service provider: wallets that speak the LIJOX standard (LiJ and others)
open channels with it, receive while offline, and keep their Black start kits with it.

## Before you install

1. **LND (Terminus)**, not Start9's stock LND. It is Start9's LND with one patch that opens the channels LIJOX wallets
   ask for (zero-conf, no anchors). It installs as an update over your LND and keeps its data, its channels and the
   apps that use it (BTCPay, RTL …). Update LND only from the LND (Terminus) download page: Start9's own LND update
   puts the stock build back — nothing is lost, and the "LND (Terminus)" check here turns red until LND (Terminus) is
   installed again.
2. **Bitcoin on-chain in LND's wallet**: more than the on-chain reserve you will set, plus public channels with room to
   send out.
3. **A way in.** LiJ is a web wallet, so this service needs a public `https://` and `wss://` address. With Cloudflare:
   make a tunnel in your Cloudflare account with two public names — one to `http://localhost:7000`, one to
   `http://localhost:7001` — and copy its token. A tunnel you already use for another app stays as it is.

## After install

1. **Settings → Start here**: the node name (filled in from LND's alias), the two public addresses, the tunnel token,
   and the **on-chain reserve** — your own number; LND's on-chain balance is shown beside it.
2. **LND → Watchtower Server**: pick the address other nodes reach it on. LIJOX providers watch for each other.
3. **Console enrolment**: add the code to an authenticator app (SHA1, 6 digits, 30 seconds).

## Stay online

While this server is off, its wallets cannot pay or be paid, and after 24 hours the LIJOX registry marks it stale. Do
not reindex Bitcoin or LND while wallets are using this provider.

## The console

On this service's **Console** interface — keep it on your local network; do not add a public domain to it. It is a
report: channels, wallets served, balances, the lease, PL. Settings are changed in Settings, never in the console.

## What it reaches out to

LND on this server; the LIJOX registries you set (registration every 6 hours); the price feed while wallets ask for
rates; the wallet vendors' push services when it wakes a sleeping wallet; Cloudflare, when the tunnel is on. No
telemetry, no update checks.
