// The module host under which all modules are registered.
import { ModuleHost } from 'cordette'
import env from './environment'

export const host = new ModuleHost(env.token, env.clientId)
export default host
