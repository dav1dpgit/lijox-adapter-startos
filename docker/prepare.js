// LIJOX Adapter for StartOS — the prepare step (a oneshot before the adapter starts, every start).
//
// 1. Waits for LND's REST port.
// 2. Keeps the adapter's own least-privilege macaroon: baked once from LND's admin macaroon with the adapter's
//    recipe (bake-permissions-nodelegate.json) under a root key id of its own, plus a close-only macaroon for lncli
//    under the same id. It bakes again when the recipe changes (a new adapter release that needs a new permission)
//    or when the stored macaroon stops working (LND restored, key revoked), then deletes the old root key id so the
//    old macaroons stop working. Nothing to do by hand on any operator's box.
// 3. Writes the node identity (public key, public peer address) the adapter registers with.
// Secrets go to files under KEYS_DIR (mode 0600), never to the log.
//
// env: LND_REST host:port · REST_CA path (empty = no certificate check) · ADMIN_MACAROON path · RECIPE path ·
//      KEYS_DIR path · PEER_ADDRESS_OVERRIDE host:port (optional)
'use strict'
const fs = require('fs')
const path = require('path')
const https = require('https')
const crypto = require('crypto')

const env = process.env
const [restHost, restPort] = splitHostPort(env.LND_REST || '')
const KEYS = env.KEYS_DIR || '/data/lnd-keys'
const CLOSE_PERMISSIONS = [{ entity: 'uri', action: '/lnrpc.Lightning/CloseChannel' }]
const ca = env.REST_CA ? fs.readFileSync(env.REST_CA) : null

function splitHostPort(s) {
  const i = s.lastIndexOf(':')
  return i > 0 ? [s.slice(0, i).replace(/^\[|\]$/g, ''), Number(s.slice(i + 1))] : ['', 0]
}
const log = (m) => console.log('[prepare] ' + m)

function rest(method, p, macaroonHex, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null
    const req = https.request(
      Object.assign(
        {
          host: restHost,
          port: restPort,
          path: p,
          method,
          headers: Object.assign(
            { 'Grpc-Metadata-macaroon': macaroonHex, 'Content-Type': 'application/json' },
            payload ? { 'Content-Length': Buffer.byteLength(payload) } : {},
          ),
          timeout: 15000,
        },
        ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false },
      ),
      (res) => {
        let data = ''
        res.on('data', (c) => (data += c))
        res.on('end', () => {
          let json = null
          try { json = JSON.parse(data) } catch (_) {}
          resolve({ status: res.statusCode, json, text: data })
        })
        res.on('error', reject)
      },
    )
    req.on('timeout', () => req.destroy(new Error('LND REST did not answer within 15 s')))
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

function writeSecret(name, data) {
  const file = path.join(KEYS, name)
  const tmp = file + '.tmp'
  fs.writeFileSync(tmp, data, { mode: 0o600 })
  fs.renameSync(tmp, file)
}
function readJson(name) {
  try { return JSON.parse(fs.readFileSync(path.join(KEYS, name), 'utf8')) } catch (_) { return null }
}

async function main() {
  if (!restHost || !restPort) throw new Error('LND_REST is not set (LND is not reachable on the internal network yet)')
  fs.mkdirSync(KEYS, { recursive: true, mode: 0o700 })
  const admin = fs.readFileSync(env.ADMIN_MACAROON).toString('hex')
  const recipe = JSON.parse(fs.readFileSync(env.RECIPE, 'utf8'))
  const permissions = recipe.permissions
  if (!Array.isArray(permissions) || !permissions.length) throw new Error('the adapter recipe has no permissions: ' + env.RECIPE)
  const recipeSha = crypto.createHash('sha256').update(JSON.stringify({ permissions, close: CLOSE_PERMISSIONS })).digest('hex')

  // 1. LND's REST port, with patience (LND starting, wallet being unlocked)
  let info = null
  for (let i = 1; i <= 60; i++) {
    try {
      const r = await rest('GET', '/v1/getinfo', admin)
      if (r.status === 200 && r.json && r.json.identity_pubkey) { info = r.json; break }
      log(`LND REST answered ${r.status} — waiting (${i}/60)`)
    } catch (e) {
      if (/certificate|self[- ]signed|unable to verify/i.test(e.message) && ca) {
        throw new Error(`LND REST's certificate did not pass the check against ${env.REST_CA}: ${e.message}. ` +
          `Turn off "Check LND REST certificate" in Settings → Advanced if StartOS's certificate cannot pass (see the README).`)
      }
      log(`LND REST not reachable yet (${e.message}) — waiting (${i}/60)`)
    }
    await new Promise((r) => setTimeout(r, 5000))
  }
  if (!info) throw new Error('LND REST did not answer in 5 minutes')

  // 2. the adapter's macaroons
  const state = readJson('state.json')
  let keep = false
  if (state && state.recipe_sha256 === recipeSha && fs.existsSync(path.join(KEYS, 'adapter.hex')) && fs.existsSync(path.join(KEYS, 'close.macaroon'))) {
    const mine = fs.readFileSync(path.join(KEYS, 'adapter.hex'), 'utf8').trim()
    const r = await rest('GET', '/v1/getinfo', mine)
    keep = r.status === 200
    if (!keep) log(`the stored adapter macaroon is refused by LND (${r.status}) — baking a new one`)
  } else if (state) {
    log('the adapter recipe changed — baking a new macaroon')
  } else {
    log('first start — baking the adapter macaroon')
  }
  if (!keep) {
    const rootKeyId = String(crypto.randomInt(1000000, 2000000000))
    const a = await rest('POST', '/v1/macaroon', admin, { permissions, root_key_id: rootKeyId })
    if (a.status !== 200 || !a.json || !a.json.macaroon) throw new Error(`baking the adapter macaroon failed: HTTP ${a.status} ${a.text.slice(0, 200)}`)
    const c = await rest('POST', '/v1/macaroon', admin, { permissions: CLOSE_PERMISSIONS, root_key_id: rootKeyId })
    if (c.status !== 200 || !c.json || !c.json.macaroon) throw new Error(`baking the close macaroon failed: HTTP ${c.status} ${c.text.slice(0, 200)}`)
    writeSecret('adapter.hex', a.json.macaroon)
    writeSecret('close.macaroon', Buffer.from(c.json.macaroon, 'hex'))
    writeSecret('state.json', JSON.stringify({ root_key_id: rootKeyId, recipe_sha256: recipeSha, permissions: permissions.length, baked_at: new Date().toISOString() }))
    log(`baked: ${permissions.length} permissions for the adapter, CloseChannel for lncli (root key id ${rootKeyId})`)
    if (state && state.root_key_id && state.root_key_id !== rootKeyId) {
      const d = await rest('DELETE', '/v1/macaroon/' + encodeURIComponent(state.root_key_id), admin)
      log(d.status === 200 ? `the old root key id ${state.root_key_id} is deleted — its macaroons no longer work`
        : `could not delete the old root key id ${state.root_key_id} (HTTP ${d.status}); its macaroons still work until it is deleted`)
    }
  } else {
    log(`the adapter macaroon is current (root key id ${state.root_key_id})`)
  }

  // 3. the node identity
  const override = String(env.PEER_ADDRESS_OVERRIDE || '').trim()
  const uri = (Array.isArray(info.uris) && info.uris[0]) || ''
  const host = override || (uri.includes('@') ? uri.split('@')[1] : '')
  writeSecret('identity.json', JSON.stringify({ pubkey: info.identity_pubkey, host }))
  log(`node ${String(info.identity_pubkey).slice(0, 16)}… · public peer address ${host || '(none advertised)'}` +
    (override ? ' (from Settings)' : ''))
}

main().catch((e) => {
  console.error('[prepare] ' + e.message)
  process.exit(1)
})
