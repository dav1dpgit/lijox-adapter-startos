import { i18n } from './i18n'
import { sdk } from './sdk'
import { apiPort, consolePort, wsPort } from './utils'

// Three interfaces. Where each is reachable (LAN, a public domain, Tor) is the operator's choice in StartOS;
// the bundled Cloudflare tunnel reaches the API and WebSocket ports from inside the container.
export const setInterfaces = sdk.setupInterfaces(async ({ effects }) => {
  const receipts = []

  // the LIJOX / LSPS2 API wallets call
  const apiOrigin = await sdk.MultiHost.of(effects, 'api').bindPort(apiPort, {
    protocol: 'http',
  })
  const api = sdk.createInterface(effects, {
    name: i18n('API'),
    id: 'api',
    description: i18n(
      'The LIJOX API wallets call — the public HTTPS address in Settings points here',
    ),
    type: 'api',
    masked: false,
    schemeOverride: null,
    username: null,
    path: '',
    query: {},
  })
  receipts.push(await apiOrigin.export([api]))

  // the browser wallets' WebSocket to LND's peer port
  const wsOrigin = await sdk.MultiHost.of(effects, 'ws').bindPort(wsPort, {
    protocol: 'http',
  })
  const ws = sdk.createInterface(effects, {
    name: i18n('WebSocket'),
    id: 'ws',
    description: i18n(
      'Browser wallets reach LND through this — the public WSS address in Settings points here',
    ),
    type: 'api',
    masked: false,
    schemeOverride: null,
    username: null,
    path: '',
    query: {},
  })
  receipts.push(await wsOrigin.export([ws]))

  // the operator console (TOTP login) — keep it on the local network
  const consoleOrigin = await sdk.MultiHost.of(effects, 'console').bindPort(
    consolePort,
    { protocol: 'http' },
  )
  const consoleUi = sdk.createInterface(effects, {
    name: i18n('Console'),
    id: 'console',
    description: i18n(
      'The operator console: a report of channels, wallets, balances, the lease and PL. Keep it on your local network.',
    ),
    type: 'ui',
    masked: false,
    schemeOverride: null,
    username: null,
    path: '/console',
    query: {},
  })
  receipts.push(await consoleOrigin.export([consoleUi]))

  return receipts
})
