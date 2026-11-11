import { sdk } from '../sdk'
import { consoleEnrolment } from './consoleEnrolment'
import { settings } from './settings'

export const actions = sdk.Actions.of()
  .addAction(settings)
  .addAction(consoleEnrolment)
