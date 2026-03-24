/**
 * Veil Strike v5 → v6 Migration Script
 *
 * This script updates the backend registry from v5 seed markets to v6.
 * v5 on-chain markets live on veil_strike_v5.aleo and cannot be moved —
 * v6 markets must be created fresh on the new programs.
 *
 * What this does:
 * 1. Backs up the current dynamic-markets.json
 * 2. Clears the dynamic registry (v5 markets won't resolve on v6 programs)
 * 3. Logs migration status
 *
 * New v6 markets are created via the frontend Create Market page or
 * POST /api/markets/register. The scanner will pick them up automatically.
 *
 * Usage: npx tsx scripts/migrate-v6.ts
 */

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(__dirname, '..', 'data');
const DYNAMIC_FILE = path.join(DATA_DIR, 'dynamic-markets.json');
const BACKUP_FILE = path.join(DATA_DIR, 'dynamic-markets-v5-backup.json');
const GOV_FILE = path.join(DATA_DIR, 'governance-registry.json');

console.log('=== Veil Strike v5 → v6 Migration ===\n');

// 1. Backup existing dynamic registry
if (fs.existsSync(DYNAMIC_FILE)) {
  const data = fs.readFileSync(DYNAMIC_FILE, 'utf-8');
  const parsed = JSON.parse(data);
  const count = Object.keys(parsed).length;
  fs.writeFileSync(BACKUP_FILE, data);
  console.log(`[Backup] Saved ${count} dynamic market(s) to ${BACKUP_FILE}`);
} else {
  console.log('[Backup] No dynamic-markets.json found, skipping backup');
}

// 2. Clear dynamic registry for v6 fresh start
fs.writeFileSync(DYNAMIC_FILE, JSON.stringify({}, null, 2));
console.log('[Migrate] Cleared dynamic-markets.json for v6');

// 3. Initialize governance registry
if (!fs.existsSync(GOV_FILE)) {
  fs.writeFileSync(GOV_FILE, JSON.stringify([], null, 2));
  console.log('[Migrate] Created empty governance-registry.json');
} else {
  console.log('[Migrate] governance-registry.json already exists');
}

// 4. Print program info
console.log('\n=== v6 Program Deployment ===');
console.log('Main (ALEO):  veil_strike_v6.aleo');
console.log('CX (USDCx):   veil_strike_v6_cx.aleo');
console.log('SD (USAD):    veil_strike_v6_sd.aleo');

console.log('\n=== v5 Seed Markets (read-only, for reference) ===');
const v5Seeds = [
  { q: 'Will Bitcoin reach $100K by end of 2026?', type: 'ALEO', lightning: false },
  { q: 'Will SpaceX land humans on Mars by 2027?', type: 'ALEO', lightning: false },
  { q: 'Will US adopt a national CBDC by 2027?', type: 'ALEO', lightning: false },
  { q: 'Best Streaming Platform 2026', type: 'ALEO', lightning: false },
  { q: 'BTC Lightning Round', type: 'ALEO', lightning: true },
  { q: 'ETH Lightning Round', type: 'ALEO', lightning: true },
  { q: 'ALEO Lightning Round', type: 'ALEO', lightning: true },
  { q: 'BTC Lightning Round (USDCx)', type: 'USDCX', lightning: true },
  { q: 'ETH Lightning Round (USDCx)', type: 'USDCX', lightning: true },
  { q: 'ALEO Lightning Round (USDCx)', type: 'USDCX', lightning: true },
];
v5Seeds.forEach((s, i) => console.log(`  ${i + 1}. [${s.type}] ${s.q}${s.lightning ? ' (Lightning)' : ''}`));

console.log('\n=== Next Steps ===');
console.log('1. Start the backend: npm run dev');
console.log('2. Create v6 markets via the frontend Create page or POST /api/markets/register');
console.log('3. Lightning markets: Use the Create Lightning form');
console.log('4. The scanner will auto-discover new v6 markets from on-chain');
console.log('5. Governance proposals can be created from the /governance page');

console.log('\n✓ Migration complete');
