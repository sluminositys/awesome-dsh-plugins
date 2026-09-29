#!/usr/bin/env node
// Explicit opt-in install smoke test. Run in a disposable worker, never on a developer's profile.
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { readEvidence, LEDGER, TARGET } from './compatibility.mjs';

const slug = process.argv[2]?.toLowerCase();
const feed = JSON.parse(readFileSync('plugins.json', 'utf8'));
const plugin = feed.plugins.find((p) => new URL(p.url).pathname.slice(1).toLowerCase() === slug);
if (!plugin) throw Error('Pass one exact owner/repo from plugins.json');
// No shells, pipes, URLs containing spaces, npx, curl, or profile switching.
const match = plugin.install.match(/^dsh plugin(?: --profile ([\w-]+))? add ([^\s'"`;|&$()]+)$/);
if (!match) throw Error(`Unsupported command shape: ${plugin.install}`);
const version = spawnSync('dsh', ['--version'], { encoding: 'utf8', timeout: 15000 });
if (version.error || version.status !== 0 || !new RegExp(`(^|[^\d])${TARGET.replaceAll('.', '\\.')}($|[^\d])`).test(version.stdout + version.stderr)) {
  throw Error(`Expected dsh ${TARGET}; found: ${version.stdout || version.stderr || version.error}`);
}
const home = mkdtempSync(join(tmpdir(), 'dsh-compat-'));
try {
  const args = ['plugin', '--profile', match[1] || 'web', 'add', match[2]];
  const result = spawnSync('dsh', args, { encoding: 'utf8', timeout: 120000,
    maxBuffer: 1024 * 1024, env: { ...process.env, HOME: home, XDG_CONFIG_HOME: join(home, 'config'),
      XDG_DATA_HOME: join(home, 'data'), XDG_CACHE_HOME: join(home, 'cache') } });
  const evidence = readEvidence();
  const entry = { version: TARGET, command: plugin.install, result: result.status === 0 && !result.error ? 'passed' : 'failed',
    checkedAt: new Date().toISOString() };
  evidence.entries[slug] ||= [];
  evidence.entries[slug].push(entry);
  writeFileSync(LEDGER, JSON.stringify(evidence, null, 2) + '\n');
  console.log(`${slug}: ${entry.result} on DSH ${TARGET} (${entry.checkedAt})`);
  if (entry.result === 'failed') {
    console.error(String(result.stderr || result.error || `exit ${result.status}`).slice(0, 2000));
    process.exitCode = 1;
  }
} finally {
  rmSync(home, { recursive: true, force: true });
}
