import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const scriptPath = join(
  process.cwd(),
  'node_modules',
  'react-native',
  'scripts',
  'xcode',
  'with-environment.sh',
);

const before = 'if [ -n "$1" ]; then\n  $1\nfi';
const after = 'if [ -n "$1" ]; then\n  "$@"\nfi';

const script = readFileSync(scriptPath, 'utf8');

if (script.includes(after)) {
  process.exit(0);
}

if (!script.includes(before)) {
  throw new Error(`Expected React Native Xcode environment snippet was not found in ${scriptPath}`);
}

writeFileSync(scriptPath, script.replace(before, after));
