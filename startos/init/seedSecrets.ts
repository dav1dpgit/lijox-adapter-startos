import { createECDH, randomBytes } from 'crypto'
import { storeJson } from '../fileModels/store.json'
import { sdk } from '../sdk'

// RFC 4648 base32, no padding — the form the console's TOTP and authenticator apps read
function base32(buf: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += alphabet[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += alphabet[(value << (5 - bits)) & 31]
  return out
}

// The secrets the adapter needs, made once and never typed: the route token, the console's TOTP secret and the
// wake-push (VAPID) key pair. Only what is missing is made, so a restore keeps the secrets it brings back.
export const seedSecrets = sdk.setupOnInit(async (effects) => {
  const store = await storeJson.read().once()
  const add: Record<string, string> = {}
  if (!store?.adapterSecret) add.adapterSecret = randomBytes(32).toString('hex')
  if (!store?.totpSecret) add.totpSecret = base32(randomBytes(20))
  if (!store?.vapidPublicKey || !store?.vapidPrivateKey) {
    const ecdh = createECDH('prime256v1')
    ecdh.generateKeys()
    add.vapidPublicKey = ecdh.getPublicKey().toString('base64url')
    // web-push wants exactly 32 bytes; the key comes back shorter when it starts with zero bytes
    const priv = ecdh.getPrivateKey()
    add.vapidPrivateKey = Buffer.concat([
      Buffer.alloc(32 - priv.length),
      priv,
    ]).toString('base64url')
  }
  if (Object.keys(add).length || !store) await storeJson.merge(effects, add)
})
