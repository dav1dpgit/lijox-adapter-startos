// LIJOX Adapter for StartOS — read a few facts from LND's REST port.
//
//   node lnd-facts.js facts    prints one JSON line: { alias, version, terminus, onchain_confirmed_sat,
//                              onchain_total_sat } — the Settings form shows the alias as the default name and the
//                              on-chain balance beside the on-chain reserve. Exit 1 when LND does not answer.
//   node lnd-facts.js health   the "LND (Terminus)" health check: exit 0 when LND's version line carries the
//                              "-terminus" stamp of LND (Terminus), exit 2 when it does not (Start9's stock build),
//                              exit 1 when LND does not answer. Prints LND's version line.
//
// env: LND_REST host:port · REST_CA path (empty = no certificate check) · MACAROON path (a binary .macaroon, or a
//      file holding it as hex)
'use strict'
const fs = require('fs')
const https = require('https')

const env = process.env
const mode = process.argv[2] || 'facts'

function splitHostPort(s) {
  const i = s.lastIndexOf(':')
  return i > 0 ? [s.slice(0, i).replace(/^\[|\]$/g, ''), Number(s.slice(i + 1))] : ['', 0]
}
const [host, port] = splitHostPort(env.LND_REST || '')
const ca = env.REST_CA ? fs.readFileSync(env.REST_CA) : null

function macaroonHex() {
  const raw = fs.readFileSync(env.MACAROON)
  const text = raw.toString('utf8').trim()
  return /^[0-9a-f]+$/i.test(text) ? text : raw.toString('hex')
}

function get(path, mac) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      Object.assign(
        { host, port, path, method: 'GET', headers: { 'Grpc-Metadata-macaroon': mac }, timeout: 10000 },
        ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false },
      ),
      (res) => {
        let data = ''
        res.on('data', (c) => (data += c))
        res.on('end', () => {
          if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} on ${path}`))
          try { resolve(JSON.parse(data)) } catch (e) { reject(e) }
        })
      },
    )
    req.on('timeout', () => req.destroy(new Error('LND REST did not answer within 10 s')))
    req.on('error', reject)
    req.end()
  })
}

async function main() {
  if (!host || !port) throw new Error('LND_REST is not set')
  const mac = macaroonHex()
  const info = await get('/v1/getinfo', mac)
  const version = String(info.version || '')
  const terminus = /-terminus\b/.test(version)
  if (mode === 'health') {
    console.log(version)
    process.exit(terminus ? 0 : 2)
  }
  let bal = {}
  try { bal = await get('/v1/balance/blockchain', mac) } catch (_) {}
  console.log(JSON.stringify({
    alias: String(info.alias || ''),
    version,
    terminus,
    onchain_confirmed_sat: bal.confirmed_balance === undefined ? null : Number(bal.confirmed_balance),
    onchain_total_sat: bal.total_balance === undefined ? null : Number(bal.total_balance),
  }))
}

main().catch((e) => {
  console.error('[lnd-facts] ' + e.message)
  process.exit(1)
})
