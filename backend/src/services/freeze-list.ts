// Freeze List — computes MerkleProofs for USDCX/USAD compliance.
// Ported from frontend/src/utils/freezeListProof.ts for server-side use.

import { config } from '../config';
import { fetchWithTimeout } from './fetch-timeout';

const FREEZELIST_PROGRAMS: Record<string, string> = {
  USDCX: 'usdcx_freezelist.aleo',
  USAD: 'usad_freezelist.aleo',
};
const ALEO_API = `${config.aleoEndpoint}/${config.aleoNetwork}`;

// ESM import helper
const importESM = new Function('specifier', 'return import(specifier)') as (s: string) => Promise<any>;

// Cache WASM module to avoid re-importing on every call
let wasmCache: any = null;
async function getWasm() {
  if (!wasmCache) wasmCache = await importESM('@provablehq/wasm');
  return wasmCache;
}

function getFreezelistProgramId(tokenType: 'USDCX' | 'USAD' = 'USDCX'): string {
  return FREEZELIST_PROGRAMS[tokenType];
}

export async function getFreezeListCount(tokenType: 'USDCX' | 'USAD' = 'USDCX'): Promise<number> {
  try {
    const res = await fetchWithTimeout(
      `${ALEO_API}/program/${getFreezelistProgramId(tokenType)}/mapping/freeze_list_last_index/true`,
      {}, 15_000,
    );
    if (res.ok) {
      const val = await res.text();
      if (val) {
        const parsed = parseInt(val.replace('u32', '').replace(/['"]/g, ''));
        return isNaN(parsed) ? 0 : parsed + 1;
      }
    }
  } catch (e) {
    console.error('[FreezeList] Error fetching count:', e);
  }
  return 0;
}

export async function getFreezeListIndex(
  index: number,
  tokenType: 'USDCX' | 'USAD' = 'USDCX',
): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(
      `${ALEO_API}/program/${getFreezelistProgramId(tokenType)}/mapping/freeze_list_index/${index}u32`,
      {}, 15_000,
    );
    if (res.ok) {
      const val = await res.text();
      return val ? val.replace(/['"]/g, '').trim() : null;
    }
  } catch (e) {
    console.error(`[FreezeList] Error fetching index ${index}:`, e);
  }
  return null;
}

export async function generateFreezeListProof(
  targetIndex: number = 1,
  occupiedLeafValue?: string,
): Promise<string> {
  try {
    const wasm = await getWasm();
    const { Poseidon4, Field } = wasm;
    const hasher = new Poseidon4();

    // Pre-compute empty hashes for each tree level
    const emptyHashes: string[] = [];
    let currentEmpty = '0field';
    for (let i = 0; i < 16; i++) {
      emptyHashes.push(currentEmpty);
      const f = Field.fromString(currentEmpty);
      const nextHashField = hasher.hash([f, f]);
      currentEmpty = nextHashField.toString();
    }

    let currentHash = '0field';
    let currentIndex = targetIndex;
    const proofSiblings: string[] = [];

    for (let i = 0; i < 16; i++) {
      const isLeft = currentIndex % 2 === 0;
      const siblingIndex = isLeft ? currentIndex + 1 : currentIndex - 1;

      let siblingHash = emptyHashes[i];
      if (i === 0 && siblingIndex === 0 && occupiedLeafValue) {
        siblingHash = occupiedLeafValue;
      }

      proofSiblings.push(siblingHash);

      const fCurrent = Field.fromString(currentHash);
      const fSibling = Field.fromString(siblingHash);

      const input = isLeft ? [fCurrent, fSibling] : [fSibling, fCurrent];
      const nextHashField = hasher.hash(input);
      currentHash = nextHashField.toString();

      currentIndex = Math.floor(currentIndex / 2);
    }

    return `{ siblings: [${proofSiblings.join(', ')}], leaf_index: ${targetIndex}u32 }`;
  } catch (e) {
    console.warn('[FreezeList] Merkle Proof Generation Warning (using fallback):', e);
    const s = Array(16).fill('0field').join(', ');
    return `{ siblings: [${s}], leaf_index: ${targetIndex}u32 }`;
  }
}

/**
 * Compute the full pair of MerkleProofs needed for USDCX/USAD transfer_private_to_public.
 * Returns a string like `[{ siblings: [...], leaf_index: 1u32 }, { siblings: [...], leaf_index: 1u32 }]`
 */
export async function getUsdcxProofs(tokenType: 'USDCX' | 'USAD' = 'USDCX'): Promise<string> {
  const count = await getFreezeListCount(tokenType);
  const firstIndex = count > 0 ? await getFreezeListIndex(0, tokenType) : null;

  let index0FieldStr: string | undefined;
  if (firstIndex) {
    try {
      const wasm = await getWasm();
      const { Address } = wasm;
      const addr = Address.from_string(firstIndex);
      const grp = addr.toGroup();
      const x = grp.toXCoordinate();
      index0FieldStr = x.toString();
    } catch (e) {
      console.warn('[FreezeList] Failed to convert freeze list address to field:', e);
    }
  }

  const proof = await generateFreezeListProof(1, index0FieldStr);
  return `[${proof}, ${proof}]`;
}
