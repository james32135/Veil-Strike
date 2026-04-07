const FREEZELIST_PROGRAMS: Record<string, string> = {
  USDCX: 'usdcx_freezelist.aleo',
  USAD: 'usad_freezelist.aleo',
};
const ALEO_API = 'https://api.provable.com/v2/mainnet';

function getFreezelistProgramId(tokenType: 'USDCX' | 'USAD' = 'USDCX'): string {
  return FREEZELIST_PROGRAMS[tokenType];
}

export async function getFreezeListRoot(tokenType: 'USDCX' | 'USAD' = 'USDCX'): Promise<string | null> {
  try {
    const res = await fetch(`${ALEO_API}/program/${getFreezelistProgramId(tokenType)}/mapping/freeze_list_root/1u8`);
    if (res.ok) {
      const val = await res.text();
      return val ? val.replace(/['"]/g, '').trim() : null;
    }
  } catch (e) {
    console.error('Error fetching freeze list root:', e);
  }
  return null;
}

export async function getFreezeListCount(tokenType: 'USDCX' | 'USAD' = 'USDCX'): Promise<number> {
  try {
    const res = await fetch(`${ALEO_API}/program/${getFreezelistProgramId(tokenType)}/mapping/freeze_list_last_index/true`);
    if (res.ok) {
      const val = await res.text();
      if (val) {
        const parsed = parseInt(val.replace('u32', '').replace(/['"]/g, ''));
        return isNaN(parsed) ? 0 : parsed + 1;
      }
    }
  } catch (e) {
    console.error('Error fetching freeze list count:', e);
  }
  return 0;
}

export async function getFreezeListIndex(index: number, tokenType: 'USDCX' | 'USAD' = 'USDCX'): Promise<string | null> {
  try {
    const res = await fetch(`${ALEO_API}/program/${getFreezelistProgramId(tokenType)}/mapping/freeze_list_index/${index}u32`);
    if (res.ok) {
      const val = await res.text();
      return val ? val.replace(/['"]/g, '').trim() : null;
    }
  } catch (e) {
    console.error(`Error fetching freeze list index ${index}:`, e);
  }
  return null;
}

export async function generateFreezeListProof(
  targetIndex: number = 1,
  occupiedLeafValue?: string
): Promise<string> {
  try {
    const { Poseidon4, Field } = await import('@provablehq/wasm');
    const hasher = new Poseidon4();

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
    console.warn('Merkle Proof Generation Warning (using fallback):', e);
    const s = Array(16).fill('0field').join(', ');
    return `{ siblings: [${s}], leaf_index: ${targetIndex}u32 }`;
  }
}

export async function getUsdcxProofs(tokenType: 'USDCX' | 'USAD' = 'USDCX'): Promise<string> {
  const count = await getFreezeListCount(tokenType);
  const firstIndex = count > 0 ? await getFreezeListIndex(0, tokenType) : null;

  let index0FieldStr: string | undefined;
  if (firstIndex) {
    try {
      const { Address } = await import('@provablehq/wasm');
      const addr = Address.from_string(firstIndex);
      const grp = addr.toGroup();
      const x = grp.toXCoordinate();
      index0FieldStr = x.toString();
    } catch (e) {
      console.warn('Failed to convert freeze list address to field:', e);
    }
  }

  const proof = await generateFreezeListProof(1, index0FieldStr);
  return `[${proof}, ${proof}]`;
}
