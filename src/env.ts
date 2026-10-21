// Loads .env if present. Imported first by index.ts so other modules see the values,
// and so hosts that just run `node dist/index.js` (e.g. Pterodactyl panels) still work.
import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');
