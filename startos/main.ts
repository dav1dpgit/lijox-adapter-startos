import { FileHelper } from '@start9labs/start-sdk'
import {
  controlHostId,
  gRPCHostId,
  gRPCPort,
  peerHostId,
  peerPort,
  restPort,
} from 'lnd-startos/startos/interfaces'
import { manifest as lndManifest } from 'lnd-startos/startos/manifest'
import { storeJson } from './fileModels/store.json'
import { i18n } from './i18n'
import { sdk } from './sdk'
import {
  addressHost,
  adapterDataDir,
  adminMacaroonPath,
  apiPort,
  commitmentType,
  consolePort,
  dataDir,
  keysDir,
  lndConfPath,
  lndMount,
  lndScbPath,
  lndTlsCertPath,
  recipePath,
  rootCaFile,
  rootCaPath,
  tunnelMetrics,
  wsPort,
} from './utils'

// a number left empty in Settings = the adapter's own default: the variable is not set
const opt = (v: number | null | undefined) =>
  v === null || v === undefined ? undefined : String(v)

function splitHostPort(s: string): [string, string] {
  const i = s.lastIndexOf(':')
  return [s.slice(0, i).replace(/^\[|\]$/g, ''), s.slice(i + 1)]
}

export const main = sdk.setupMain(async ({ effects }) => {
  console.info(i18n('Starting the LIJOX adapter'))

  const s = await storeJson.read().const(effects)
  if (
    !s?.nodeName ||
    !s.publicHttpsUrl ||
    !s.publicWssUrl ||
    s.jitMinOnchainReserveSats === null
  ) {
    throw new Error(
      i18n(
        'Run Settings first: the node name, the public HTTPS and WSS addresses, and the on-chain reserve',
      ),
    )
  }
  if (
    !s.adapterSecret ||
    !s.totpSecret ||
    !s.vapidPublicKey ||
    !s.vapidPrivateKey
  ) {
    throw new Error(
      i18n('The adapter’s secrets are missing — restart the service once'),
    )
  }

  // No anchors (DP, 2026-10-06): LND (Terminus) is a plain version just above Start9's (DP, 2026-10-23), so no version
  // rule can tell it from stock LND. The "LND (Terminus)" health check below reads LND's own version line instead.

  // LND on the internal network. Each address heals main with one restart when it changes or first appears
  // (LND binds gRPC and REST only after its wallet is unlocked).
  const grpc = await sdk.host
    .getBridgeAddress(effects, {
      packageId: 'lnd',
      hostId: gRPCHostId,
      internalPort: gRPCPort,
    })
    .const()
  const rest = await sdk.host
    .getBridgeAddress(effects, {
      packageId: 'lnd',
      hostId: controlHostId,
      internalPort: restPort,
    })
    .const()
  const peer = await sdk.host
    .getBridgeAddress(effects, {
      packageId: 'lnd',
      hostId: peerHostId,
      internalPort: peerPort,
    })
    .const()
  if (!grpc || !rest || !peer) {
    throw new Error(
      i18n(
        'LND is not reachable on the internal network yet — start LND and unlock its wallet',
      ),
    )
  }
  const [peerHost, peerPortStr] = splitHostPort(peer)

  // the console listens on the container's own address too, so StartOS's proxy (the Console interface) reaches it
  const containerIp = await sdk.getContainerIp(effects).const()

  // D3: LND's REST answers through StartOS's proxy, so its certificate chains to StartOS's root CA
  if (s.restCertificateCheck) {
    await FileHelper.string({
      base: sdk.volumes.main,
      subpath: rootCaFile,
    }).write(effects, await sdk.getRootCa(effects))
  }

  const mounts = sdk.Mounts.of()
    .mountVolume({
      volumeId: 'main',
      subpath: null,
      mountpoint: dataDir,
      readonly: false,
    })
    .mountDependency<typeof lndManifest>({
      dependencyId: 'lnd',
      volumeId: 'main',
      subpath: null,
      mountpoint: lndMount,
      readonly: true,
    })
  const sub = sdk.SubContainer.of(
    effects,
    { imageId: 'adapter' },
    mounts,
    'adapter-sub',
  )

  const env: Record<string, string | undefined> = {
    // where things are
    ADAPTER_PORT: String(apiPort),
    WS_PROXY_PORT: String(wsPort),
    CONSOLE_PORT: String(consolePort),
    CONSOLE_TAILSCALE: 'false',
    CONSOLE_BIND: containerIp,
    LIJ_DATA_DIR: adapterDataDir,
    LND_ENDPOINT: `https://${rest}`,
    LND_REST_CA_PATH: s.restCertificateCheck ? rootCaPath : undefined,
    LND_GRPC_ENDPOINT: grpc,
    LND_TLS_CERT_PATH: lndTlsCertPath,
    LIJ_SCB_FILE: lndScbPath,
    LND_PEER_HOST: peerHost,
    LND_PEER_PORT: peerPortStr,
    LEASE_LNCLI: `lncli --rpcserver=${grpc} --tlscertpath=${lndTlsCertPath} --macaroonpath=${keysDir}/close.macaroon`,

    // who this provider is
    NODE_NAME: s.nodeName,
    PUBLIC_HTTPS_URL: s.publicHttpsUrl,
    PUBLIC_WSS_URL: s.publicWssUrl,
    WS_ALLOWED_ORIGINS: s.allowedOrigins.join(','),
    LIJOX_REGISTRIES: s.registries.length ? s.registries.join(',') : undefined,
    LNURLP_ADDRESS_HOST: addressHost,
    LSPS2_COMMITMENT_TYPE: commitmentType,

    // the doors (adapter 0.108.0)
    PUBLIC_REACH: s.publicReach,
    ROUTE_2_REACH: s.route2Reach === 'none' ? undefined : s.route2Reach,
    ROUTE_2_HTTPS_URL:
      s.route2Reach === 'none' ? undefined : (s.route2HttpsUrl ?? undefined),
    ROUTE_2_WSS_URL:
      s.route2Reach === 'none' ? undefined : (s.route2WssUrl ?? undefined),
    ROUTE_2_FILTER_URL:
      s.route2Reach === 'none' ? undefined : (s.route2FilterUrl ?? undefined),
    TRUST_FORWARDED_FOR: s.trustForwardedFor ? 'true' : 'false',

    // secrets made at install
    ADAPTER_SECRET: s.adapterSecret,
    CONSOLE_TOTP_SECRET: s.totpSecret,
    VAPID_PUBLIC_KEY: s.vapidPublicKey,
    VAPID_PRIVATE_KEY: s.vapidPrivateKey,
    VAPID_SUBJECT: s.publicHttpsUrl,

    // the operator's terms (empty = the adapter's default)
    FEE_PPM: opt(s.feePpm),
    CHANNEL_OPEN_FEE_MIN_SATS: opt(s.channelOpenFeeMinSats),
    CHANNEL_OPEN_FEE_PPM: opt(s.channelOpenFeePpm),
    JIT_FEE_LADDER_SATS: s.jitFeeLadderSats || undefined,
    JIT_GRANT_BASE_SATS: opt(s.jitGrantBaseSats),
    JIT_GRANT_BONUS_FROM_SATS: opt(s.jitGrantBonusFromSats),
    JIT_GRANT_BONUS_PCT: opt(s.jitGrantBonusPct),
    JIT_GRANT_CEILING_SATS: opt(s.jitGrantCeilingSats),
    JIT_MIN_ONCHAIN_RESERVE_SATS: opt(s.jitMinOnchainReserveSats),
    MIN_CHANNEL_SATS: opt(s.minChannelSats),
    MAX_CHANNEL_SATS: opt(s.maxChannelSats),
    JIT_FLOOR_MAX_OPENS_PER_DAY: opt(s.jitFloorMaxOpensPerDay),
    JIT_FLOOR_MAX_SATS_PER_DAY: opt(s.jitFloorMaxSatsPerDay),
    LEASE_ENABLE: s.leaseEnable ? 'true' : 'false',
    LEASE_DRY_RUN: s.leaseDryRun ? 'true' : 'false',
    LEASE_DAYS: opt(s.leaseDays),
    LSPS2_OFFLINE_HOLD_ENABLED: s.offlineHold ? 'true' : 'false',

    // Mix pools (Tatara); LND's own limits are read from its lnd.conf
    TATARA_ENABLED: s.tataraEnabled ? 'true' : 'false',
    TATARA_SIZES: s.tataraSizes || undefined,
    TATARA_CHANNEL_POOLS: s.tataraChannelPools ? 'true' : 'false',
    TATARA_CHANNEL_SIZES: s.tataraChannelSizes || undefined,
    TATARA_LND_CONF: lndConfPath,
  }

  // what the LND (Terminus) check and lnd-facts.js read LND with: the adapter's own macaroon
  const factsEnv = {
    LND_REST: rest,
    REST_CA: s.restCertificateCheck ? rootCaPath : '',
    MACAROON: `${keysDir}/adapter.hex`,
  }

  return sdk.Daemons.of(effects)
    .addOneshot('prepare', {
      subcontainer: sub,
      exec: {
        command: ['node', '/opt/lijox-start9/prepare.js'],
        user: 'root',
        env: {
          LND_REST: rest,
          REST_CA: s.restCertificateCheck ? rootCaPath : '',
          ADMIN_MACAROON: adminMacaroonPath,
          RECIPE: recipePath,
          KEYS_DIR: keysDir,
          PEER_ADDRESS_OVERRIDE: s.publicPeerAddress ?? '',
        },
      },
      requires: [],
    })
    .addDaemon('adapter', {
      subcontainer: sub,
      exec: {
        command: ['/opt/lijox-start9/run-adapter.sh'],
        user: 'root',
        env,
      },
      ready: {
        display: i18n('API'),
        fn: () =>
          sdk.healthCheck.checkPortListening(effects, apiPort, {
            successMessage: i18n('The API is answering'),
            errorMessage: i18n('The API is not answering'),
          }),
        gracePeriod: 120_000,
      },
      requires: ['prepare'],
    })
    .addHealthCheck('lnd-link', {
      ready: {
        display: i18n('LND link'),
        fn: () =>
          sdk.healthCheck.runHealthScript(
            [
              'wget',
              '-q',
              '-O',
              '/dev/null',
              `http://127.0.0.1:${apiPort}/health`,
            ],
            sub,
            { errorMessage: i18n('The adapter cannot read LND') },
          ),
      },
      requires: ['adapter'],
    })
    .addHealthCheck('lnd-terminus', {
      ready: {
        display: i18n('LND (Terminus)'),
        fn: async () => {
          const r = await sub.exec(
            ['node', '/opt/lijox-start9/lnd-facts.js', 'health'],
            {
              env: factsEnv,
              timeout: 20_000,
            },
          )
          if (r.exitCode === 0)
            return {
              result: 'success' as const,
              message: i18n(
                'LND is the Terminus build: wallet channels open without anchors',
              ),
            }
          if (r.exitCode === 2)
            return {
              result: 'failure' as const,
              message: i18n(
                'LND is Start9’s stock build — install LND (Terminus) from its download page. New wallet channels fail until then; nothing is lost.',
              ),
            }
          return {
            result: 'failure' as const,
            message: i18n('Cannot read LND’s version'),
          }
        },
        trigger: sdk.trigger.cooldownTrigger(300_000),
      },
      requires: ['prepare'],
    })
    .addDaemon('tunnel', () =>
      s.tunnelToken
        ? {
            subcontainer: sub,
            exec: {
              command: [
                'cloudflared',
                'tunnel',
                '--no-autoupdate',
                '--metrics',
                tunnelMetrics,
                'run',
              ],
              env: { TUNNEL_TOKEN: s.tunnelToken },
            },
            ready: {
              display: i18n('Cloudflare tunnel'),
              fn: () =>
                sdk.healthCheck.runHealthScript(
                  [
                    'wget',
                    '-q',
                    '-O',
                    '/dev/null',
                    `http://${tunnelMetrics}/ready`,
                  ],
                  sub,
                  { errorMessage: i18n('The tunnel is not connected') },
                ),
              gracePeriod: 60_000,
            },
            requires: ['adapter'],
          }
        : null,
    )
})
