import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const rootDir = process.cwd();
const rootPath = join(rootDir, 'plugin.json');
const builtPath = join(rootDir, 'dist', '_build', 'plugin.json');

const rootManifest = JSON.parse(readFileSync(rootPath, 'utf8'));
const builtManifest = JSON.parse(readFileSync(builtPath, 'utf8'));

rootManifest.entryHash = builtManifest.entryHash;
rootManifest.zipHash = builtManifest.zipHash;

writeFileSync(rootPath, `${JSON.stringify(rootManifest, null, 2)}\n`);
console.log('  sync root plugin.json hashes');
