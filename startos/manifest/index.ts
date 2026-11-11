import { setupManifest } from '@start9labs/start-sdk'
import { long, short } from './i18n'

export const manifest = setupManifest({
  id: 'lijox-adapter',
  title: 'LIJOX Adapter',
  license: 'MIT',
  packageRepo: 'https://github.com/dav1dpgit/lijox-adapter-startos',
  upstreamRepo: 'https://github.com/dav1dpgit/lijox-lnd-adapter',
  marketingUrl: 'https://lightninginajar.xyz/',
  donationUrl: null,
  description: { short, long },
  volumes: ['main', 'startos'],
  images: {
    adapter: {
      // Built from ./Dockerfile: the adapter at a pinned commit of the public repo (hash-checked), lncli, cloudflared
      source: { dockerBuild: {} },
      arch: ['x86_64', 'aarch64'],
      emulateMissing: false,
    },
  },
})
