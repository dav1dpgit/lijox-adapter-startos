import { sdk } from './sdk'

// The adapter's data (lease state, kits held for wallets, notes, PL ledger), its baked macaroons and the settings.
// LND's own channel backup is LND's package's job.
export const { createBackup, restoreInit } = sdk.setupBackups(async () =>
  sdk.Backups.ofVolumes('main', 'startos'),
)
