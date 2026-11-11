import { settings } from '../actions/settings'
import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'

// The adapter cannot start without its name, its public addresses and the on-chain reserve (the operator's own
// number, DP 2026-10-23): a critical task until Settings has them.
export const taskSettings = sdk.setupOnInit(async (effects) => {
  const s = await storeJson
    .read((x) => ({
      nodeName: x.nodeName,
      publicHttpsUrl: x.publicHttpsUrl,
      publicWssUrl: x.publicWssUrl,
      jitMinOnchainReserveSats: x.jitMinOnchainReserveSats,
    }))
    .const(effects)
  if (
    !s?.nodeName ||
    !s?.publicHttpsUrl ||
    !s?.publicWssUrl ||
    s?.jitMinOnchainReserveSats === null ||
    s?.jitMinOnchainReserveSats === undefined
  ) {
    await sdk.action.createOwnTask(effects, settings, 'critical', {
      reason: i18n(
        'Give this provider a name, its public HTTPS and WSS addresses and its on-chain reserve',
      ),
    })
  }
})
