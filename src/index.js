import { createApp } from './app.js';
import { ensureDatabaseSchema } from './config/bootstrap.js';
import { env } from './config/env.js';

const app = createApp();

await ensureDatabaseSchema();

app.listen(env.PORT, () => {
  console.log(`Clash Companion backend listening on port ${env.PORT}`);
});
