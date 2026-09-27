import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(dir, '../package.json'), 'utf8'));

writeFileSync(
  path.join(dir, '../public/build-info.json'),
  JSON.stringify({ version: pkg.version, builtAt: new Date().toISOString() }, null, 2)
);
