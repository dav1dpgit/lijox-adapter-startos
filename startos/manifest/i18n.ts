export const short = {
  en_US: 'Run a LIJOX Lightning service provider on your LND',
}

export const long = {
  en_US:
    'The LIJOX adapter turns this server’s LND into a Lightning service provider in the open LIJOX registry. Wallets that speak the LIJOX standard open channels with it on their first payment, receive while their phone is asleep, and keep their Black start kits with it. Requires LND (Terminus), which opens the zero-conf channels without anchors that LIJOX wallets ask for.',
}

export const depLndDescription = {
  en_US:
    'The Lightning node this provider runs on. Must be LND (Terminus), the build that opens zero-conf channels without anchors.',
}

export const depBitcoindDescription = {
  en_US:
    'Optional. Checks coins for the Mix waiting list through your own node (used by a later adapter release).',
}
