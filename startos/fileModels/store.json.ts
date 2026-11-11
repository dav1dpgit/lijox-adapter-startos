import { FileHelper, z } from '@start9labs/start-sdk'
import { sdk } from '../sdk'
import { defaultOrigins, defaultRegistry } from '../utils'

// Settings (the Settings action writes them) and the secrets made at install. A number left empty means "the
// adapter's own default" — the env variable is not set, so no default is copied here and none can drift. The one
// exception is the on-chain reserve: the operator sets it himself (DP, 2026-10-23), so it has no default at all.
const num = z.number().nullable().catch(null)
const str = z.string().nullable().catch(null)

const shape = z.looseObject({
  // made at install, never typed
  adapterSecret: str,
  totpSecret: str,
  vapidPublicKey: str,
  vapidPrivateKey: str,

  // start here (the first step: the adapter stays stopped until these are set)
  nodeName: str,
  publicHttpsUrl: str,
  publicWssUrl: str,
  tunnelToken: str,
  jitMinOnchainReserveSats: num,

  // way in (adapter 0.108.0: the doors)
  publicReach: z.enum(['cloudflare', 'direct']).catch('cloudflare'),
  route2Reach: z.enum(['none', 'cloudflare', 'direct']).catch('none'),
  route2HttpsUrl: str,
  route2WssUrl: str,
  route2FilterUrl: str,
  trustForwardedFor: z.boolean().catch(false),
  publicPeerAddress: str,

  // registries (adapter 0.118.0: every registry this provider enrolls at; empty = a private provider)
  registries: z.array(z.string()).catch([defaultRegistry]),

  // wallet websites
  allowedOrigins: z.array(z.string()).catch(defaultOrigins),

  // fees
  feePpm: num,
  channelOpenFeeMinSats: num,
  channelOpenFeePpm: num,
  jitFeeLadderSats: str,
  jitGrantBaseSats: num,
  jitGrantBonusFromSats: num,
  jitGrantBonusPct: num,
  jitGrantCeilingSats: num,

  // limits
  minChannelSats: num,
  maxChannelSats: num,
  jitFloorMaxOpensPerDay: num,
  jitFloorMaxSatsPerDay: num,

  // lease and holds
  leaseEnable: z.boolean().catch(false),
  leaseDryRun: z.boolean().catch(true),
  leaseDays: num,
  offlineHold: z.boolean().catch(true),

  // Mix pools (Tatara)
  tataraEnabled: z.boolean().catch(false),
  tataraSizes: str,
  tataraChannelPools: z.boolean().catch(false),
  tataraChannelSizes: str,

  // advanced
  restCertificateCheck: z.boolean().catch(true),
})

export const storeJson = FileHelper.json(
  { base: sdk.volumes.startos, subpath: './store.json' },
  shape,
)
