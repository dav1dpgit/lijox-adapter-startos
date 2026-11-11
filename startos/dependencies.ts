import { autoconfig } from 'lnd-startos/startos/actions/config/autoconfig'
import { watchtowerServerConfig } from 'lnd-startos/startos/actions/config/watchtowerServer'
import { i18n } from './i18n'
import { depBitcoindDescription, depLndDescription } from './manifest/i18n'
import { sdk } from './sdk'

// LND (Terminus): Start9's LND with the patch that opens the zero-conf channels without anchors LIJOX wallets ask for.
// It is a plain version just above Start9's (0.21.5-beta:1 -> 0.21.5-beta:1.1), so this range cannot tell it from a
// newer stock release; the "LND (Terminus)" health check in main.ts reads LND's own version line for that.
const lnd = sdk.Dependency.required('lnd', {
  description: depLndDescription,
  metadata: {
    title: 'LND (Terminus)',
    icon: 'https://raw.githubusercontent.com/Start9Labs/lnd-startos/refs/heads/master/icon.svg',
  },
  versionRange: '>=0.21.5-beta:1.1',
  kind: 'running',
  healthChecks: ['lnd'],
}).withInit(async (effects) => {
  // the adapter's JIT opens are zero-conf with an alias (critical: the adapter is held stopped until done)
  await sdk.action.createTask(effects, 'lnd', autoconfig, 'critical', {
    input: {
      kind: 'partial',
      accept: [{ 'option-scid-alias': true, 'zero-conf': true }],
      set: { 'option-scid-alias': true, 'zero-conf': true },
    },
    when: { condition: 'input-not-matches', once: false },
    reason: i18n(
      'The LIJOX adapter opens zero-conf channels with an alias: turn on zero-conf and option-scid-alias',
    ),
  })
  // LIJOX: every provider runs a watchtower for the other providers (what it watches follows the standard's text)
  await sdk.action.createTask(
    effects,
    'lnd',
    watchtowerServerConfig,
    'important',
    {
      reason: i18n(
        'LIJOX providers run a watchtower for the other providers: turn on LND’s watchtower server',
      ),
    },
  )
})

// Bitcoin Core, optional and dormant: a later adapter release checks Mix coins through it (D4)
const bitcoind = sdk.Dependency.optional('bitcoind', {
  description: depBitcoindDescription,
  metadata: {
    title: 'Bitcoin',
    icon: 'https://raw.githubusercontent.com/Start9Labs/bitcoin-core-startos/refs/heads/31.x/icon.svg',
  },
  versionRange: '>=28.4:29 || >=#knotsprerdts:29.3:29',
  kind: 'running',
  healthChecks: [],
  enabled: async () => false,
})

export const dependencies = sdk.Dependencies.of()
  .addDependency(lnd)
  .addDependency(bitcoind)
