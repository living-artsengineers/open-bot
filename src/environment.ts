// If you're missing env.json, download it from #open-bot-dev.
import * as envConfig from './env.json'

const activeEnv: keyof typeof envConfig = 'dev'

interface Environment {
  guild: string
  clientId: string
  token: string
  umApi: {
    clientId: string
    clientSecret: string
  }
  mapboxToken: string
  adminId: string
  name: keyof typeof envConfig
}

const env: Environment = {
  ...envConfig,
  ...envConfig[activeEnv],
  name: activeEnv
}

export default env
