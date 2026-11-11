import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { LndFacts, lndFacts } from '../lndFacts'
import { sdk } from '../sdk'
import { defaultOrigins, defaultRegistry } from '../utils'

const { InputSpec, Value, List } = sdk

// An empty number field = the adapter's own default (the variable is not set).
const optionalNumber = (
  name: string,
  description: string,
  units: string,
  footnote: string,
) =>
  Value.number({
    name,
    description,
    default: null,
    required: false,
    min: 0,
    integer: true,
    units,
    footnote,
  })

const httpsAddress = (
  name: string,
  description: string,
  required: boolean,
  placeholder: string,
) =>
  Value.text({
    name,
    description,
    required,
    default: null,
    placeholder,
    patterns: [
      {
        regex: '^https://[^\\s/]+(/\\S*)?$',
        description: i18n('An address starting with https://'),
      },
    ],
  })

const wssAddress = (
  name: string,
  description: string,
  required: boolean,
  placeholder: string,
) =>
  Value.text({
    name,
    description,
    required,
    default: null,
    placeholder,
    patterns: [
      {
        regex: '^wss://[^\\s/]+(/\\S*)?$',
        description: i18n('An address starting with wss://'),
      },
    ],
  })

const sats = (n: number) => n.toLocaleString('en-US')

// The line beside the on-chain reserve: LND's on-chain balance now, read when the form opens.
function balanceLine(f: LndFacts | null): string {
  if (!f || f.onchain_confirmed_sat === null)
    return i18n(
      'LND’s on-chain balance could not be read — start LND and unlock its wallet, then open Settings again.',
    )
  const pending = (f.onchain_total_sat ?? 0) - f.onchain_confirmed_sat
  return pending > 0
    ? i18n(
        'LND’s on-chain balance now: ${confirmed} sats confirmed (${pending} sats still confirming).',
        {
          confirmed: sats(f.onchain_confirmed_sat),
          pending: sats(pending),
        },
      )
    : i18n('LND’s on-chain balance now: ${confirmed} sats.', {
        confirmed: sats(f.onchain_confirmed_sat),
      })
}

const buildSpec = (balance: string) =>
  InputSpec.of({
    startHere: Value.object(
      {
        name: i18n('Start here'),
        description: i18n(
          'The adapter starts once these are filled in. Everything below has a working default.',
        ),
      },
      InputSpec.of({
        nodeName: Value.text({
          name: i18n('Node name'),
          description: i18n(
            'The name wallets see for this provider. Filled in from LND’s alias the first time.',
          ),
          required: true,
          default: null,
          patterns: [
            {
              regex: '^.{1,40}$',
              description: i18n('1 to 40 characters'),
            },
          ],
        }),
        publicHttpsUrl: httpsAddress(
          i18n('Public HTTPS address'),
          i18n(
            'The https:// address wallets reach this provider’s API on. With a Cloudflare tunnel: the name you pointed at http://localhost:7000.',
          ),
          true,
          'https://lsp.example.com',
        ),
        publicWssUrl: wssAddress(
          i18n('Public WSS address'),
          i18n(
            'The wss:// address wallets reach LND through. With a Cloudflare tunnel: the name you pointed at http://localhost:7001.',
          ),
          true,
          'wss://lsp-ws.example.com',
        ),
        tunnelToken: Value.text({
          name: i18n('Cloudflare tunnel token'),
          description: i18n(
            'The token of a tunnel in a Cloudflare account. In that tunnel, route the HTTPS name to http://localhost:7000 and the WSS name to http://localhost:7001. Empty = no tunnel (another way in, below).',
          ),
          required: false,
          default: null,
          masked: true,
        }),
        jitMinOnchainReserveSats: Value.number({
          name: i18n('On-chain reserve'),
          description: i18n(
            'LND keeps at least this much on-chain: no wallet channel opens when its on-chain balance is below it. Your choice — there is no default.',
          ),
          required: true,
          default: null,
          min: 0,
          integer: true,
          units: 'sats',
          footnote: balance,
        }),
      }),
    ),
    wayIn: Value.object(
      {
        name: i18n('Way in'),
        description: i18n(
          'What sits between the wallets and this server. Signed into the provider’s registry record.',
        ),
      },
      InputSpec.of({
        publicReach: Value.select({
          name: i18n('The public addresses above reach this server through'),
          default: 'cloudflare',
          values: {
            cloudflare: i18n('A Cloudflare tunnel (TLS ends at Cloudflare)'),
            direct: i18n('Directly (TLS ends on this server or its own relay)'),
          },
        }),
        route2Reach: Value.select({
          name: i18n('A second door'),
          description: i18n(
            'Other addresses into the same server, e.g. direct names beside Cloudflare ones.',
          ),
          default: 'none',
          values: {
            none: i18n('None'),
            cloudflare: i18n('Through a Cloudflare tunnel'),
            direct: i18n('Directly'),
          },
        }),
        route2HttpsUrl: httpsAddress(
          i18n('Second door: HTTPS address'),
          i18n('Required when there is a second door.'),
          false,
          'https://direct-lsp.example.com',
        ),
        route2WssUrl: wssAddress(
          i18n('Second door: WSS address'),
          i18n('Required when there is a second door.'),
          false,
          'wss://direct-ws.example.com',
        ),
        route2FilterUrl: httpsAddress(
          i18n('Second door: block-filter address'),
          i18n(
            'Only if this server runs a block-filter server behind the second door.',
          ),
          false,
          'https://direct-filters.example.com',
        ),
        trustForwardedFor: Value.toggle({
          name: i18n('Trust the relay’s client address'),
          description: i18n(
            'Only behind a relay of your own that overwrites x-forwarded-for (the direct door). Never behind Cloudflare alone.',
          ),
          default: false,
        }),
        publicPeerAddress: Value.text({
          name: i18n('Public peer address'),
          description: i18n(
            'The host:port other Lightning nodes reach LND on. Empty = the address LND advertises (with Tor installed, its onion address).',
          ),
          required: false,
          default: null,
          placeholder: 'abc…xyz.onion:9735',
        }),
      }),
    ),
    registries: Value.list(
      List.text(
        {
          name: i18n('LIJOX registries'),
          description: i18n(
            'The registries this provider lists itself in; wallets read the first. Empty = a private provider nobody discovers.',
          ),
          default: [defaultRegistry],
        },
        {
          placeholder: defaultRegistry,
          patterns: [
            {
              regex: '^https://[^\\s/]+(/\\S*)?$',
              description: i18n('An address starting with https://'),
            },
          ],
        },
      ),
    ),
    allowedOrigins: Value.list(
      List.text(
        {
          name: i18n('Allowed wallet websites'),
          description: i18n(
            'Web wallets allowed to connect, as https://site. Apps that do not run in a browser connect without being listed.',
          ),
          default: defaultOrigins,
          minLength: 1,
        },
        {
          placeholder: 'https://wallet.example.com',
          patterns: [
            {
              regex: '^https://[^\\s/]+$',
              description: i18n('https:// and the site name only'),
            },
          ],
        },
      ),
    ),
    fees: Value.object(
      {
        name: i18n('Fees'),
        description: i18n('Your terms. Empty = the adapter’s default.'),
      },
      InputSpec.of({
        feePpm: optionalNumber(
          i18n('Advertised routing fee'),
          i18n('The routing fee this provider advertises.'),
          'ppm',
          i18n('Default: 1000 ppm (0.1 %)'),
        ),
        channelOpenFeeMinSats: optionalNumber(
          i18n('Channel-opening fee, floor'),
          i18n('The least a channel open costs a wallet, on every rail.'),
          'sats',
          i18n('Default: 100 sats'),
        ),
        channelOpenFeePpm: optionalNumber(
          i18n('Channel-opening fee, share'),
          i18n(
            'Or this share of the payment, whichever is more (100 ppm = 0.01 %).',
          ),
          'ppm',
          i18n('Default: 100 ppm'),
        ),
        jitFeeLadderSats: Value.text({
          name: i18n('JIT open fee ladder'),
          description: i18n(
            'A wallet’s 1st, 2nd … JIT open in the window pays these, in sats; the last repeats.',
          ),
          required: false,
          default: null,
          placeholder: '100,400,1000,2000,3000,5000,10000,15000',
          patterns: [
            {
              regex: '^\\d+(,\\d+)*$',
              description: i18n('Whole numbers separated by commas'),
            },
          ],
        }),
        jitGrantBaseSats: optionalNumber(
          i18n('JIT inbound, base'),
          i18n(
            'Every JIT channel = the payment + the granted room; every JIT gets this.',
          ),
          'sats',
          i18n('Default: 25,000 sats'),
        ),
        jitGrantBonusFromSats: optionalNumber(
          i18n('JIT inbound, bonus from'),
          i18n('The bonus counts the payment above this.'),
          'sats',
          i18n('Default: 25,000 sats'),
        ),
        jitGrantBonusPct: optionalNumber(
          i18n('JIT inbound, bonus share'),
          i18n('This % (rounded down) of the payment above the “bonus from”.'),
          '%',
          i18n('Default: 50 %'),
        ),
        jitGrantCeilingSats: optionalNumber(
          i18n('JIT inbound, ceiling'),
          i18n('The granted room never exceeds this.'),
          'sats',
          i18n('Default: 62,500 sats'),
        ),
      }),
    ),
    limits: Value.object(
      {
        name: i18n('Limits'),
        description: i18n('Empty = the adapter’s default.'),
      },
      InputSpec.of({
        minChannelSats: optionalNumber(
          i18n('Smallest channel'),
          i18n('The smallest channel this provider opens to a wallet.'),
          'sats',
          i18n('Default: 100,000 sats'),
        ),
        maxChannelSats: optionalNumber(
          i18n('Largest channel'),
          i18n('The largest channel this provider opens to a wallet.'),
          'sats',
          i18n('Default: 2,000,000 sats'),
        ),
        jitFloorMaxOpensPerDay: optionalNumber(
          i18n('Low-reserve opens per day'),
          i18n(
            'How many channel opens a day may use the small wallet-side reserve. Above it, opens use the full 1 % reserve. Not a limit on the total put into wallet channels.',
          ),
          'opens',
          i18n('Default: 25'),
        ),
        jitFloorMaxSatsPerDay: optionalNumber(
          i18n('Low-reserve channel sats per day'),
          i18n(
            'The total channel size a day the small wallet-side reserve may cover.',
          ),
          'sats',
          i18n('Default: 2,000,000 sats'),
        ),
      }),
    ),
    leaseAndHolds: Value.object(
      { name: i18n('Lease and holds'), description: null },
      InputSpec.of({
        leaseEnable: Value.toggle({
          name: i18n('Lease'),
          description: i18n(
            'Close a wallet’s channel after it has not been in contact for the lease period. It closes nothing until the exclusion list has been saved once in the console.',
          ),
          default: false,
        }),
        leaseDryRun: Value.toggle({
          name: i18n('Lease dry run'),
          description: i18n(
            'Log what the lease would close and close nothing. Turn off once the exclusion list in the console is right.',
          ),
          default: true,
        }),
        leaseDays: optionalNumber(
          i18n('Lease period'),
          i18n('Days without contact before the lease closes a channel.'),
          'days',
          i18n('Default: 60 days'),
        ),
        offlineHold: Value.toggle({
          name: i18n('Hold payments for sleeping wallets'),
          description: i18n(
            'Hold a payment for a wallet whose phone is closed and wake it; each wallet’s own setting sets how long.',
          ),
          default: true,
        }),
      }),
    ),
    mixPools: Value.object(
      {
        name: i18n('Mix pools'),
        description: i18n('LIJOX’s Tatara pools. Off unless you turn them on.'),
      },
      InputSpec.of({
        tataraEnabled: Value.toggle({
          name: i18n('Offer Mix pools'),
          description: null,
          default: false,
        }),
        tataraSizes: Value.text({
          name: i18n('Pool sizes'),
          description: i18n(
            'Sats, separated by commas, each at least 10,000. Empty = the adapter’s default.',
          ),
          required: false,
          default: null,
          placeholder: '50000,100000,250000,1000000',
          patterns: [
            {
              regex: '^\\d+(,\\d+)*$',
              description: i18n('Whole numbers separated by commas'),
            },
          ],
        }),
        tataraChannelPools: Value.toggle({
          name: i18n('On-chain → channel pools'),
          description: i18n(
            'Needs LND’s “max pending channels” at 3 or more, and the channel sizes below inside the smallest and largest channel.',
          ),
          default: false,
        }),
        tataraChannelSizes: Value.text({
          name: i18n('Channel pool sizes'),
          description: i18n(
            'Sats, separated by commas. Required when channel pools are on.',
          ),
          required: false,
          default: null,
          placeholder: '100000',
          patterns: [
            {
              regex: '^\\d+(,\\d+)*$',
              description: i18n('Whole numbers separated by commas'),
            },
          ],
        }),
      }),
    ),
    advanced: Value.object(
      { name: i18n('Advanced'), description: null },
      InputSpec.of({
        restCertificateCheck: Value.toggle({
          name: i18n('Check LND REST certificate'),
          description: i18n(
            'Check the certificate LND’s REST port answers with against StartOS’s root certificate authority. Turn off only if the check cannot pass on this server.',
          ),
          default: true,
        }),
      }),
    ),
  })

export const settings = sdk.Action.withInput(
  // id
  'settings',

  // metadata
  async ({ effects }) => ({
    name: i18n('Settings'),
    description: i18n(
      'This provider’s name, public addresses, on-chain reserve, way in, fees and limits',
    ),
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  }),

  // form input specification — built when the form opens, so the reserve shows LND's balance now
  async ({ effects }) => buildSpec(balanceLine(await lndFacts(effects))),

  // pre-fill the form from the store; the first time, the name from LND's alias
  async ({ effects }) => {
    const s = await storeJson.read().once()
    const alias = s?.nodeName
      ? null
      : ((await lndFacts(effects))?.alias ?? null)
    return {
      startHere: {
        nodeName: s?.nodeName ?? (alias ? alias.slice(0, 40) : undefined),
        publicHttpsUrl: s?.publicHttpsUrl ?? undefined,
        publicWssUrl: s?.publicWssUrl ?? undefined,
        tunnelToken: s?.tunnelToken ?? null,
        jitMinOnchainReserveSats: s?.jitMinOnchainReserveSats ?? undefined,
      },
      wayIn: {
        publicReach: s?.publicReach ?? 'cloudflare',
        route2Reach: s?.route2Reach ?? 'none',
        route2HttpsUrl: s?.route2HttpsUrl ?? null,
        route2WssUrl: s?.route2WssUrl ?? null,
        route2FilterUrl: s?.route2FilterUrl ?? null,
        trustForwardedFor: s?.trustForwardedFor ?? false,
        publicPeerAddress: s?.publicPeerAddress ?? null,
      },
      registries: s?.registries ?? [defaultRegistry],
      allowedOrigins: s?.allowedOrigins ?? defaultOrigins,
      fees: {
        feePpm: s?.feePpm ?? null,
        channelOpenFeeMinSats: s?.channelOpenFeeMinSats ?? null,
        channelOpenFeePpm: s?.channelOpenFeePpm ?? null,
        jitFeeLadderSats: s?.jitFeeLadderSats ?? null,
        jitGrantBaseSats: s?.jitGrantBaseSats ?? null,
        jitGrantBonusFromSats: s?.jitGrantBonusFromSats ?? null,
        jitGrantBonusPct: s?.jitGrantBonusPct ?? null,
        jitGrantCeilingSats: s?.jitGrantCeilingSats ?? null,
      },
      limits: {
        minChannelSats: s?.minChannelSats ?? null,
        maxChannelSats: s?.maxChannelSats ?? null,
        jitFloorMaxOpensPerDay: s?.jitFloorMaxOpensPerDay ?? null,
        jitFloorMaxSatsPerDay: s?.jitFloorMaxSatsPerDay ?? null,
      },
      leaseAndHolds: {
        leaseEnable: s?.leaseEnable ?? false,
        leaseDryRun: s?.leaseDryRun ?? true,
        leaseDays: s?.leaseDays ?? null,
        offlineHold: s?.offlineHold ?? true,
      },
      mixPools: {
        tataraEnabled: s?.tataraEnabled ?? false,
        tataraSizes: s?.tataraSizes ?? null,
        tataraChannelPools: s?.tataraChannelPools ?? false,
        tataraChannelSizes: s?.tataraChannelSizes ?? null,
      },
      advanced: { restCertificateCheck: s?.restCertificateCheck ?? true },
    }
  },

  // check what a form cannot, write the store; the service restarts with the new settings
  async ({ effects, input }) => {
    const w = input.wayIn
    const r2https = w.route2HttpsUrl?.trim() || null
    const r2wss = w.route2WssUrl?.trim() || null
    if (w.route2Reach !== 'none' && (!r2https || !r2wss))
      throw new Error(
        i18n('A second door needs both its HTTPS and its WSS address.'),
      )
    const m = input.mixPools
    if (m.tataraChannelPools && !m.tataraChannelSizes?.trim())
      throw new Error(i18n('Channel pools need their sizes.'))
    await storeJson.merge(effects, {
      nodeName: input.startHere.nodeName,
      publicHttpsUrl: input.startHere.publicHttpsUrl,
      publicWssUrl: input.startHere.publicWssUrl,
      tunnelToken: input.startHere.tunnelToken?.trim() || null,
      jitMinOnchainReserveSats: input.startHere.jitMinOnchainReserveSats,
      publicReach: w.publicReach,
      route2Reach: w.route2Reach,
      route2HttpsUrl: w.route2Reach === 'none' ? null : r2https,
      route2WssUrl: w.route2Reach === 'none' ? null : r2wss,
      route2FilterUrl:
        w.route2Reach === 'none' ? null : w.route2FilterUrl?.trim() || null,
      trustForwardedFor: w.trustForwardedFor,
      publicPeerAddress: w.publicPeerAddress?.trim() || null,
      registries: input.registries.map((x) => x.trim()).filter(Boolean),
      allowedOrigins: input.allowedOrigins,
      feePpm: input.fees.feePpm,
      channelOpenFeeMinSats: input.fees.channelOpenFeeMinSats,
      channelOpenFeePpm: input.fees.channelOpenFeePpm,
      jitFeeLadderSats: input.fees.jitFeeLadderSats?.trim() || null,
      jitGrantBaseSats: input.fees.jitGrantBaseSats,
      jitGrantBonusFromSats: input.fees.jitGrantBonusFromSats,
      jitGrantBonusPct: input.fees.jitGrantBonusPct,
      jitGrantCeilingSats: input.fees.jitGrantCeilingSats,
      minChannelSats: input.limits.minChannelSats,
      maxChannelSats: input.limits.maxChannelSats,
      jitFloorMaxOpensPerDay: input.limits.jitFloorMaxOpensPerDay,
      jitFloorMaxSatsPerDay: input.limits.jitFloorMaxSatsPerDay,
      leaseEnable: input.leaseAndHolds.leaseEnable,
      leaseDryRun: input.leaseAndHolds.leaseDryRun,
      leaseDays: input.leaseAndHolds.leaseDays,
      offlineHold: input.leaseAndHolds.offlineHold,
      tataraEnabled: m.tataraEnabled,
      tataraSizes: m.tataraSizes?.trim() || null,
      tataraChannelPools: m.tataraChannelPools,
      tataraChannelSizes: m.tataraChannelSizes?.trim() || null,
      restCertificateCheck: input.advanced.restCertificateCheck,
    })
  },
)
