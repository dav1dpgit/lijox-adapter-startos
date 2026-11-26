import { VersionInfo } from '@start9labs/start-sdk'

const notes = `LIJOX Adapter, adapter release v0.146.0 (pinned by commit, hash-checked at build). Installs over 0.119.0:0; settings, data and macaroons stay.

- The adapter's LND macaroon is baked again by itself at the first start: v0.146.0 uses ten more LND calls (the held open's PSBT funding, GetNodeInfo, three block reads).
- Wallets that announce it get the held open (adapter 0.124.0): a JIT channel's funding transaction is signed from LND's wallet but published only once the wallet has claimed the payment.
- A wallet's requests can come inside its Lightning connection to this node (adapter 0.137.0 to 0.146.0); the Console's pane "Not inside Lightning" shows the ones that still came as web requests. Nothing is refused.
- The Console's backup pane reads LND's channel backup file (read-only).
- No new settings; every new adapter setting keeps its default.`

export const current = VersionInfo.of({
  version: '0.146.0:0',
  releaseNotes: {
    en_US: notes,
    es_ES: notes,
    de_DE: notes,
    pl_PL: notes,
    fr_FR: notes,
  },
  migrations: {
    up: async () => {},
    down: async () => {},
  },
})
