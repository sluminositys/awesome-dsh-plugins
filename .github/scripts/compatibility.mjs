import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

export const TARGET = '0.2.0-rc.1';
export const LEDGER = '.github/data/compatibility.json';

export function readEvidence() {
  try {
    const data = JSON.parse(readFileSync(LEDGER, 'utf8'));
    if (data.schemaVersion !== 1 || typeof data.entries !== 'object' || !data.entries) throw Error('invalid evidence');
    return data;
  } catch (error) {
    if (error.code === 'ENOENT') return { schemaVersion: 1, entries: {} };
    throw error;
  }
}

export function state(slug, command, evidence) {
  const checks = evidence.entries[slug.toLowerCase()] || [];
  const matching = checks.filter((c) => c.command === command && c.version &&
    ['passed', 'failed'].includes(c.result) && /^\d{4}-\d\d-\d\dT/.test(c.checkedAt));
  const current = matching.filter((c) => c.version === TARGET).at(-1);
  if (current) return { status: current.result === 'passed' ? 'current' : 'failed',
    dshVersion: current.version, checkedAt: current.checkedAt };
  const old = matching.filter((c) => c.result === 'passed').at(-1);
  if (old) return { status: 'older', dshVersion: old.version, checkedAt: old.checkedAt };
  return { status: 'unverified', dshVersion: null, checkedAt: null };
}

export function summary(rows) {
  const counts = { current: 0, older: 0, unverified: 0, failed: 0 };
  for (const row of rows) counts[row.status]++;
  return counts;
}

export function writeBadges(rows) {
  const counts = summary(rows);
  mkdirSync('badges', { recursive: true });
  writeFileSync('badges/verified.json', JSON.stringify({ schemaVersion: 1, label: `DSH ${TARGET}`,
    message: `${counts.current}/${rows.length} install verified`,
    color: counts.failed ? 'red' : counts.current ? 'green' : 'lightgrey' }, null, 2) + '\n');
  const dates = rows.filter((r) => r.checkedAt).map((r) => r.checkedAt.slice(0, 10)).sort();
  writeFileSync('badges/checked-at.json', JSON.stringify({ schemaVersion: 1,
    label: 'last DSH install check', message: dates.at(-1) || 'none',
    color: dates.length ? 'blue' : 'lightgrey' }, null, 2) + '\n');
}
