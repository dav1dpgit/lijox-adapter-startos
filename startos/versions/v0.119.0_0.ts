import { VersionInfo } from '@start9labs/start-sdk'

// No install of the first build (0.94.0:0, never installed anywhere) exists, so the graph starts here.
const notes = `LIJOX Adapter, adapter release v0.119.0 (pinned by commit, hash-checked at build).

- Runs on LND (Terminus) 0.21.5-beta:1.1 or later on the same server. A health check, "LND (Terminus)", reads LND's own version line and turns red when Start9's stock LND is installed instead.
- Settings, first step: the node name (filled in from LND's alias), the public HTTPS and WSS addresses, the Cloudflare tunnel token, and the on-chain reserve — no default; LND's on-chain balance is shown beside it.
- New settings since v0.94.0: the second door and the relay's client address (0.108.0), several LIJOX registries (0.118.0), the smallest and largest channel, the daily low-reserve open limits, and Mix pools (off unless turned on).
- On with nothing to set: holding wallets' Black start kits, and the /recover page.
- Asks LND to run its watchtower server (a task: the operator picks the address).`

export const v_0_119_0_0 = VersionInfo.of({
  version: '0.119.0:0',
  releaseNotes: {
    en_US: notes,
    es_ES: notes,
    de_DE: notes,
    pl_PL: notes,
    fr_FR: notes,
  },
  migrations: {
    up: async () => {},
  },
})
