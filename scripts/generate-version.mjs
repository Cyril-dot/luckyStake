// Generates public/version.json at build time with a unique build ID.
// The app's version-check compares this against the stored version on every
// load — on mismatch it clears stale caches and hard-reloads.
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

const version = {
  buildId: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
  builtAt: new Date().toISOString(),
};

mkdirSync(publicDir, { recursive: true });
writeFileSync(join(publicDir, 'version.json'), JSON.stringify(version, null, 2));
console.log(`[version] wrote public/version.json buildId=${version.buildId}`);
