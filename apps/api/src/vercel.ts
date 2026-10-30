import { createApp } from "./app";
import { buildDeps } from "./deps";
import { loadEnv } from "./env";

/**
 * Vercel Function entry: the whole API as one Express handler. `pnpm build` bundles this
 * (with the workspace's TypeScript packages) into dist/server.mjs; api/index.mjs re-exports it as the Vercel Function.
 */
const app = createApp(await buildDeps(loadEnv()));
export default app;
