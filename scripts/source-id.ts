import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
export function sourceIdentity() {
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', 'src', 'scripts', 'package.json', 'package-lock.json', 'vite.config.ts', 'index.html', 'watch.html', 'compare.html', 'tsconfig.json'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean).sort();
  const hash = createHash('sha256');
  for (const file of new Set(files)) { hash.update(file); hash.update('\0'); hash.update(readFileSync(file)); hash.update('\0'); }
  return `sha256:${hash.digest('hex')}`;
}
