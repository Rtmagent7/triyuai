import { createApp } from "./app";
import { buildDeps } from "./deps";
import { loadEnv } from "./env";

const env = loadEnv();
const deps = await buildDeps(env);
createApp(deps).listen(env.PORT, () => {
  deps.logger.info(`TRIYUAI API on http://localhost:${env.PORT} (docs at /docs)`);
});
