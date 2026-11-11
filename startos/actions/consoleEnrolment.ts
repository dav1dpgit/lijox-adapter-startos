import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'

// The console's TOTP secret, made at install. Shown here so the operator can add it to an authenticator app
// (and add it again on a new phone).
export const consoleEnrolment = sdk.Action.withoutInput(
  // id
  'console-enrolment',

  // metadata
  async ({ effects }) => ({
    name: i18n('Console enrolment'),
    description: i18n(
      'Show the code that adds the operator console to an authenticator app',
    ),
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  }),

  // handler
  async ({ effects }) => {
    const store = await storeJson.read().once()
    const secret = store?.totpSecret
    if (!secret)
      throw new Error(i18n('No console secret yet — restart the service once'))
    const label = encodeURIComponent(
      `LIJOX console ${store?.nodeName || ''}`.trim(),
    )
    const uri = `otpauth://totp/${label}?secret=${secret}&issuer=LIJOX&algorithm=SHA1&digits=6&period=30`
    return {
      version: '1' as const,
      title: i18n('Console enrolment'),
      message: i18n(
        'Add this to an authenticator app (SHA1, 6 digits, 30 seconds), then sign in to the Console interface with its codes. Keep the Console interface on your local network.',
      ),
      result: {
        type: 'group' as const,
        value: [
          {
            type: 'single' as const,
            name: i18n('Secret'),
            description: i18n('For manual entry'),
            value: secret,
            masked: true,
            copyable: true,
            qr: false,
            launchable: false,
          },
          {
            type: 'single' as const,
            name: i18n('Authenticator link'),
            description: i18n('Scan the QR code with the authenticator app'),
            value: uri,
            masked: true,
            copyable: true,
            qr: true,
            launchable: false,
          },
        ],
      },
    }
  },
)
