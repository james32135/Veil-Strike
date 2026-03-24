// Must be run from backend/ dir: cd backend && node ../scripts/scan-tokens.mjs
import { RecordCiphertext, ViewKey } from '@provablehq/sdk';

const VIEW_KEY = 'AViewKey1ivG8cmW3atW8etvuBBNhYcTNrQyaXJNzAvFXx7UNq96K';
const ENDPOINT = 'https://api.explorer.provable.com/v1/testnet';
const PROGRAMS = ['test_usdcx_stablecoin.aleo', 'test_usad_stablecoin.aleo'];

const vk = ViewKey.from_string(VIEW_KEY);

async function main() {
  const latest = parseInt(await (await fetch(`${ENDPOINT}/block/height/latest`)).text());
  console.log(`Latest block: ${latest}`);
  console.log('Scanning last 2000 blocks for USDCx/USAD Token records...');

  let found = 0;
  const SCAN = 2000;

  for (let h = latest; h >= latest - SCAN; h--) {
    const scanned = latest - h;
    if (scanned > 0 && scanned % 200 === 0) console.log(`  scanned ${scanned} blocks, found ${found} records`);
    try {
      const r = await fetch(`${ENDPOINT}/block/${h}/transactions`);
      if (!r.ok) continue;
      const txs = await r.json();
      for (const tx of txs) {
        const transitions = tx?.transaction?.execution?.transitions;
        if (!transitions) continue;
        for (const tr of transitions) {
          if (!PROGRAMS.includes(tr.program)) continue;
          const outputs = tr.outputs;
          if (!outputs) continue;
          for (const out of outputs) {
            if (out.type === 'record' && out.value) {
              try {
                const ct = RecordCiphertext.fromString(out.value);
                if (ct.isOwner(vk)) {
                  const pt = ct.decrypt(vk);
                  console.log(`FOUND at block ${h}: ${tr.program}/${tr.function}`);
                  console.log(`  ${pt.toString().substring(0, 400)}`);
                  found++;
                }
              } catch {}
            }
          }
        }
      }
    } catch {}
  }

  console.log(`\nDone. Total found: ${found}`);
  if (found === 0) {
    console.log('No USDCx/USAD Token records found in last 2000 blocks.');
  }
}

main().catch(console.error);
