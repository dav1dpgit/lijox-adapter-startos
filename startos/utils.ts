// Ports the adapter listens on inside the container
export const apiPort = 7000
export const wsPort = 7001
export const consolePort = 7004
// cloudflared's metrics server (its /ready answers 200 once the tunnel is connected)
export const tunnelMetrics = '127.0.0.1:20241'

export const dataDir = '/data' as const
export const lndMount = '/mnt/lnd' as const
export const keysDir = `${dataDir}/lnd-keys` as const
export const adapterDataDir = `${dataDir}/adapter` as const
export const rootCaFile = 'startos-root-ca.pem'
export const rootCaPath = `${dataDir}/${rootCaFile}` as const
export const adminMacaroonPath =
  `${lndMount}/data/chain/bitcoin/mainnet/admin.macaroon` as const
export const lndTlsCertPath = `${lndMount}/tls.cert` as const
// LND's channel backup file, read for the Console's backup pane (adapter 0.123.0; read-only here)
export const lndScbPath =
  `${lndMount}/data/chain/bitcoin/mainnet/channel.backup` as const
export const lndConfPath = `${lndMount}/lnd.conf` as const
export const recipePath =
  '/opt/lijox-adapter/bake-permissions-nodelegate.json' as const

// LIJOX defaults for a new provider
export const defaultRegistry = 'https://lij-worker.dp-a95.workers.dev'
export const defaultOrigins = ['https://lightninginajar.xyz']
// The @lightninginajar.xyz pay-code names the registry routes to their provider
export const addressHost = 'lightninginajar.xyz'
// LND (Terminus) opens zero-conf channels without anchors (static remote key)
export const commitmentType = 'STATIC_REMOTE_KEY'
