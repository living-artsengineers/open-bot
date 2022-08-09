// If you're missing env.json, download it from #open-bot-dev.
import * as envConfig from "./env.json";

const activeEnv: keyof typeof envConfig = "dev";

interface Environment {
  guild: string;
  clientId: string;
  token: string;
  umApi: {
    clientId: string;
    clientSecret: string;
  };
  mapboxToken: string;
  name: keyof typeof envConfig;
}

export default {
  ...envConfig[activeEnv],
  name: activeEnv,
} as Environment;
