// Record Scanner — discovers the bot's unspent USDCX Token records via Provable Scanner API.
// Flow: register view key → poll sync status → fetch unspent owned records (decrypted).

import { config } from '../config';
import { fetchWithTimeout } from './fetch-timeout';

const SCANNER_BASE = `https://api.provable.com/scanner/${config.aleoNetwork}`;
const PRIVATE_KEY = process.env.RESOLVER_PRIVATE_KEY || process.env.PRIVATE_KEY || '';

// ESM import helper (same as delegated-prover.ts)
const importESM = new Function('specifier', 'return import(specifier)') as (s: string) => Promise<any>;

let jwtToken: string | null = null;
let jwtExpiration: number = 0;
let scannerUuid: string | null = null;
let viewKeyStr: string | null = null;

// ─── Auth ────────────────────────────────────────────────────────────────────

async function getJwt(): Promise<string> {
  // Refresh if within 10s of expiration (JWT lifetime is ~2 min)
  if (jwtToken && Date.now() < jwtExpiration - 10_000) return jwtToken;

  if (!config.provableApiKey || !config.provableConsumerId) {
    throw new Error('[RecordScanner] Provable API credentials not configured');
  }

  const res = await fetchWithTimeout(`https://api.provable.com/jwts/${config.provableConsumerId}`, {
    method: 'POST',
    headers: { 'X-Provable-API-Key': config.provableApiKey },
  }, 15_000);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[RecordScanner] JWT fetch failed (${res.status}): ${text}`);
  }

  const authHeader = res.headers.get('authorization');
  if (!authHeader) throw new Error('[RecordScanner] No authorization header in JWT response');

  const body = (await res.json()) as { exp: number };
  jwtToken = authHeader;
  jwtExpiration = body.exp * 1000;
  // New JWT session — scanner UUID from old session may be invalid
  scannerUuid = null;
  console.log(`[RecordScanner] JWT obtained, expires ${new Date(jwtExpiration).toISOString()}`);
  return jwtToken;
}

async function getViewKey(): Promise<string> {
  if (viewKeyStr) return viewKeyStr;
  if (!PRIVATE_KEY) throw new Error('[RecordScanner] No RESOLVER_PRIVATE_KEY set');

  const sdk = await importESM('@provablehq/sdk/mainnet.js');
  const account = new sdk.Account({ privateKey: PRIVATE_KEY });
  viewKeyStr = account.viewKey().to_string() as string;
  console.log(`[RecordScanner] Derived view key: ${viewKeyStr!.slice(0, 20)}...`);
  return viewKeyStr!;
}

// ─── Scanner Registration ────────────────────────────────────────────────────

export async function registerScanner(): Promise<string> {
  if (scannerUuid) return scannerUuid;

  const jwt = await getJwt();
  const viewKey = await getViewKey();

  console.log(`[RecordScanner] Registering view key with Provable Scanner...`);
  const res = await fetchWithTimeout(`${SCANNER_BASE}/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': jwt,
    },
    body: JSON.stringify({ view_key: viewKey, start: 0 }),
  }, 30_000);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[RecordScanner] Register failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { uuid: string };
  scannerUuid = data.uuid;
  console.log(`[RecordScanner] Registered. UUID: ${scannerUuid}`);
  return scannerUuid!;
}

// ─── Scanner Status ──────────────────────────────────────────────────────────

export async function getScannerStatus(): Promise<{ synced: boolean; percentage: number }> {
  const jwt = await getJwt();

  const res = await fetchWithTimeout(`${SCANNER_BASE}/status`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Authorization': jwt,
    },
  }, 15_000);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[RecordScanner] Status check failed (${res.status}): ${text}`);
  }

  return (await res.json()) as { synced: boolean; percentage: number };
}

// ─── Fetch Unspent USDCX Token Records ───────────────────────────────────────

export interface OwnedRecord {
  block_height: string;
  commitment: string;
  function_name: string;
  output_index: number;
  owner: string;
  program_name: string;
  record_ciphertext: string;
  record_plaintext: string;
  record_name: string;
  spent: boolean;
  tag: string;
  transaction_id: string;
  transition_id: string;
}

/**
 * Fetch the bot's unspent USDCX Token records from Provable Scanner API.
 * Returns decrypted record plaintexts ready to pass as inputs to `pm.provingRequest()`.
 */
export async function fetchUnspentUsdcxRecords(
  tokenProgram: string = 'usdcx_stablecoin.aleo',
): Promise<OwnedRecord[]> {
  let jwt = await getJwt();
  let uuid = await registerScanner();

  let res = await fetchWithTimeout(`${SCANNER_BASE}/records/owned`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': jwt,
    },
    body: JSON.stringify({
      decrypt: true,
      unspent: true,
      uuid,
      filter: {
        programs: [tokenProgram],
        records: ['Token'],
      },
    }),
  }, 30_000);

  // Retry once on 401 — JWT or scanner UUID may have expired
  if (res.status === 401) {
    console.warn(`[RecordScanner] 401 on records/owned — refreshing JWT and re-registering...`);
    jwtToken = null;
    jwtExpiration = 0;
    scannerUuid = null;
    jwt = await getJwt();
    uuid = await registerScanner();
    res = await fetchWithTimeout(`${SCANNER_BASE}/records/owned`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': jwt,
      },
      body: JSON.stringify({
        decrypt: true,
        unspent: true,
        uuid,
        filter: {
          programs: [tokenProgram],
          records: ['Token'],
        },
      }),
    }, 30_000);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[RecordScanner] Fetch owned records failed (${res.status}): ${text}`);
  }

  const records = (await res.json()) as OwnedRecord[];
  console.log(`[RecordScanner] Found ${records.length} unspent ${tokenProgram} Token records`);
  return records;
}

/**
 * Decrypt a record ciphertext using the bot's view key.
 */
async function decryptRecord(ciphertext: string): Promise<string> {
  const viewKey = await getViewKey();
  const sdk = await importESM('@provablehq/sdk/mainnet.js');
  const vk = sdk.ViewKey.from_string(viewKey);
  const record = sdk.RecordCiphertext.fromString(ciphertext);
  const plaintext = record.decrypt(vk);
  return plaintext.toString();
}

/**
 * Find a single unspent USDCX Token record with at least `minAmount` microtokens.
 * Returns the `record_plaintext` string, ready to pass as a transaction input.
 */
export async function findUsdcxRecord(
  minAmount: number,
  tokenProgram: string = 'usdcx_stablecoin.aleo',
): Promise<string | null> {
  const records = await fetchUnspentUsdcxRecords(tokenProgram);

  for (const rec of records) {
    // Decrypt locally if scanner didn't return plaintext
    let plaintext = rec.record_plaintext;
    if (!plaintext && rec.record_ciphertext) {
      try {
        plaintext = await decryptRecord(rec.record_ciphertext);
        console.log(`[RecordScanner] Decrypted record: ${plaintext.slice(0, 200)}`);
      } catch (err) {
        console.warn(`[RecordScanner] Failed to decrypt record:`, err);
        continue;
      }
    }
    if (!plaintext) continue;

    const match = plaintext.match(/amount:\s*([\d_]+)u128/);
    if (match) {
      const amount = parseInt(match[1].replace(/_/g, ''), 10);
      if (amount >= minAmount) {
        console.log(`[RecordScanner] Found Token record with ${amount} µUSDCX (need ${minAmount})`);
        return plaintext;
      }
    }
  }

  console.warn(`[RecordScanner] No unspent Token record >= ${minAmount} found in ${tokenProgram}`);
  return null;
}
