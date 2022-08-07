// If you're missing env.json, download it from #open-bot-dev.
import * as envConfig from './env.json'

interface Environment {
    guild: number,
    appId: number,
    token: string,
    name: 'dev'|'prod'
}

export default { ...envConfig[envConfig.env], name: envConfig.env } as Environment
