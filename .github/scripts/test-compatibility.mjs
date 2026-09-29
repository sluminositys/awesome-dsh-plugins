import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { state, summary, TARGET } from './compatibility.mjs';

const slug = 'owner/repo', command = 'dsh plugin --profile web add package';
const check = (version, result, checkedAt) => ({ version, result, checkedAt, command });
const old = check('0.1.7-rc.2', 'passed', '2026-08-27T00:00:00Z');
const failed = check(TARGET, 'failed', '2026-09-29T00:00:00Z');
const passed = check(TARGET, 'passed', '2026-09-29T01:00:00Z');
assert.equal(state(slug, command, { entries: {} }).status, 'unverified');
assert.equal(state(slug, command, { entries: { [slug]: [old] } }).status, 'older');
assert.equal(state(slug, command, { entries: { [slug]: [old, failed] } }).status, 'failed');
assert.equal(state(slug, command, { entries: { [slug]: [old, failed, passed] } }).status, 'current');
assert.equal(state(slug, command + '2', { entries: { [slug]: [passed] } }).status, 'unverified');
assert.deepEqual(summary([{ status: 'current' }, { status: 'older' },
  { status: 'failed' }, { status: 'unverified' }]),
{ current: 1, older: 1, failed: 1, unverified: 1 });

const feed = JSON.parse(readFileSync('plugins.json', 'utf8'));
const csv = readFileSync('catalog.csv', 'utf8');
const catalog = readFileSync('CATALOG.md', 'utf8');
const readme = readFileSync('README.md', 'utf8');
const rows = catalog.split('\n').filter((l) => /^\| \[/.test(l));
const csvRows = csv.trimEnd().split('\n').slice(1);
assert.equal(feed.count, feed.plugins.length);
assert.equal(rows.length, feed.count);
assert.equal(csv.split('\n').filter(Boolean).length - 1, feed.count);
assert.ok(readme.includes(`${feed.count} documented plugin entries`));
for (const [i, plugin] of feed.plugins.entries()) {
  const slug = new URL(plugin.url).pathname.slice(1);
  const expected = state(slug, plugin.install, { entries: JSON.parse(readFileSync('.github/data/compatibility.json', 'utf8')).entries });
  assert.deepEqual(plugin.compatibility, expected);
  assert.ok(rows[i].includes(`| ${expected.status} | ${expected.dshVersion || '—'} |`));
  assert.ok(rows[i].includes(`| ${plugin.documentedCommand ? 'yes' : 'no'} |`));
  assert.ok(csvRows[i].endsWith(`,${expected.status},${expected.dshVersion || ''},${expected.checkedAt || ''}`));
}
const badge = JSON.parse(readFileSync('badges/verified.json', 'utf8'));
const checked = JSON.parse(readFileSync('badges/checked-at.json', 'utf8'));
const counts = summary(feed.plugins.map((p) => p.compatibility));
assert.equal(badge.message, `${counts.current}/${feed.count} install verified`);
const dates = feed.plugins.map((p) => p.compatibility.checkedAt).filter(Boolean).sort();
assert.equal(checked.message, dates.at(-1)?.slice(0, 10) || 'none');
console.log(`Compatibility states and four generated views agree for ${feed.count} entries.`);
