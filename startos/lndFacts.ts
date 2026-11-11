import { FileHelper, T } from '@start9labs/start-sdk'
import { controlHostId, restPort } from 'lnd-startos/startos/interfaces'
import { manifest as lndManifest } from 'lnd-startos/startos/manifest'
import { storeJson } from './fileModels/store.json'
import { sdk } from './sdk'
import {
  adminMacaroonPath,
  dataDir,
  lndMount,
  rootCaFile,
  rootCaPath,
} from './utils'

// What the Settings form shows from LND: its alias (the default name) and its on-chain balance (beside the on-chain
// reserve). Read with LND's admin macaroon in a short-lived container, because the Settings form can be opened before
// the adapter has ever started. null when LND is not running or its wallet is locked — the form then says so.
export type LndFacts = {
  alias: string
  version: string
  terminus: boolean
  onchain_confirmed_sat: number | null
  onchain_total_sat: number | null
}

let cached: { at: number; facts: LndFacts | null } | null = null

export async function lndFacts(effects: T.Effects): Promise<LndFacts | null> {
  if (cached && Date.now() - cached.at < 30_000) return cached.facts
  let facts: LndFacts | null = null
  try {
    const rest = await sdk.host
      .getBridgeAddress(effects, {
        packageId: 'lnd',
        hostId: controlHostId,
        internalPort: restPort,
      })
      .once()
    if (rest) {
      const check =
        (await storeJson.read().once())?.restCertificateCheck ?? true
      if (check) {
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
          readonly: true,
        })
        .mountDependency<typeof lndManifest>({
          dependencyId: 'lnd',
          volumeId: 'main',
          subpath: null,
          mountpoint: lndMount,
          readonly: true,
        })
      facts = await sdk.SubContainer.withTemp(
        effects,
        { imageId: 'adapter' },
        mounts,
        'lnd-facts',
        async (sub) => {
          const r = await sub.exec(
            ['node', '/opt/lijox-start9/lnd-facts.js', 'facts'],
            {
              env: {
                LND_REST: rest,
                REST_CA: check ? rootCaPath : '',
                MACAROON: adminMacaroonPath,
              },
              timeout: 20_000,
            },
          )
          if (r.exitCode !== 0) return null
          const line = String(r.stdout).trim().split('\n').pop() || ''
          return JSON.parse(line) as LndFacts
        },
      )
    }
  } catch (_) {
    facts = null
  }
  cached = { at: Date.now(), facts }
  return facts
}
