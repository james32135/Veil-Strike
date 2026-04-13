import { useState, useCallback } from 'react';
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react';
import { useNotificationStore } from '@/stores/notificationStore';
import { PROGRAM_ID, PROGRAM_ID_CX, PROGRAM_ID_SD, ALEO_API } from '@/constants';
import { resolveShieldTxId } from '@/utils/marketRegistration';
import type { AleoTransaction } from '@/types';

const EXPLORER_BASE = 'https://explorer.provable.com/transaction';

// ── Client-side record dedup ────────────────────────────────────────────────
// Track recently-used record plaintexts to avoid resubmitting a record
// that was already consumed on-chain but the wallet hasn't refreshed yet.
const usedRecordKeys = new Map<string, number>(); // key → timestamp
const RECORD_EXPIRY_MS = 30_000; // 30s — blocks concurrent bets on same record

// Permanently blacklisted records — these caused "input ID already exists" on-chain.
// Shield wallet keeps returning them as unspent, so we must skip them forever
// (until page reload when the wallet will hopefully have synced).
const blacklistedRecords = new Set<string>();

function recordKey(plaintext: string): string {
  // Use first 80 chars as a stable identifier (includes owner + unique fields)
  return plaintext.slice(0, 80);
}

export function markRecordUsed(plaintext: string) {
  usedRecordKeys.set(recordKey(plaintext), Date.now());
}

/** Permanently blacklist a record that was rejected on-chain. */
export function blacklistRecord(plaintext: string) {
  blacklistedRecords.add(recordKey(plaintext));
  console.log(`[Record] Blacklisted dead record: ${plaintext.slice(0, 40)}...`);
}

export function isRecordRecentlyUsed(plaintext: string): boolean {
  const key = recordKey(plaintext);
  // Permanently blacklisted records are always blocked
  if (blacklistedRecords.has(key)) return true;
  const ts = usedRecordKeys.get(key);
  if (!ts) return false;
  if (Date.now() - ts > RECORD_EXPIRY_MS) {
    usedRecordKeys.delete(key);
    return false;
  }
  return true;
}

/** Clear dedup entries (not blacklist) — for retry attempts. */
export function clearUsedRecords() {
  usedRecordKeys.clear();
}

export interface ShareRecord {
  plaintext: string;
  marketId: string;
  outcome: number;
  quantity: number;
  tokenType: number;
}

type TransactionStatus = 'idle' | 'preparing' | 'proving' | 'broadcasting' | 'confirmed' | 'error';

export function useTransaction() {
  const [status, setStatus] = useState<TransactionStatus>('idle');
  const [txId, setTxId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { connected, executeTransaction, requestRecords } = useWallet();
  const { addNotification, updateNotification } = useNotificationStore();

  /**
   * Fetch a credits.aleo record with at least `minMicrocredits` balance.
   * Returns the record plaintext string to pass as a transaction input.
   */
  const fetchCreditsRecord = useCallback(
    async (minMicrocredits: number): Promise<string | null> => {
      if (!connected) {
        addNotification('error', 'Wallet Not Connected', 'Please connect your Shield Wallet first.');
        return null;
      }

      // Try up to 2 attempts — Shield wallet sometimes returns stale records on first call
      for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt > 0) {
          // Clear dedup on retry — wallet may return same records but they might
          // be valid (change records, or wallet re-synced). If truly spent,
          // the chain will reject and clearUsedRecords() handles it.
          clearUsedRecords();
          console.log('[fetchCreditsRecord] Retry after 1.5s (dedup cleared)...');
          await new Promise(r => setTimeout(r, 1500));
        }
        try {
          const records = await requestRecords('credits.aleo', true);
          console.log(`[fetchCreditsRecord] Attempt ${attempt + 1} — ${records?.length ?? 0} records`);

          if (!records || records.length === 0) {
            if (attempt === 0) continue; // retry before showing error
            addNotification('error', 'No Credits Records', 'No Aleo credits records found in your wallet. You need private credits to bet with ALEO.');
            return null;
          }

          // Find unspent record with enough balance
          for (const rec of records) {
            const r = rec as Record<string, unknown>;
            const spent = r.spent as boolean | undefined;
            if (spent) continue;

            // Shield returns 'recordPlaintext', not 'plaintext'
            let plaintext: string | undefined;
            if (typeof rec === 'string') {
              plaintext = rec;
            } else {
              plaintext = (r.recordPlaintext ?? r.plaintext) as string | undefined;
            }

            // Parse microcredits from the plaintext string
            let amount = 0;
            if (plaintext) {
              const match = plaintext.match(/microcredits:\s*(\d+)u64/);
              if (match) amount = parseInt(match[1], 10);
            }

            if (amount >= minMicrocredits && plaintext) {
              if (isRecordRecentlyUsed(plaintext)) {
                console.log('[fetchCreditsRecord] Skipping recently-used record');
                continue;
              }
              markRecordUsed(plaintext);
              return plaintext;
            }
          }

          // All records either spent or recently used — retry to let wallet sync
          if (attempt === 0) continue;
          addNotification('error', 'Insufficient Credits', `No credits record with at least ${(minMicrocredits / 1_000_000).toFixed(2)} ALEO found. You may need to shield (make private) your public ALEO balance.`);
          return null;
        } catch (err) {
          if (attempt === 0) continue; // retry on error
          console.error('[fetchCreditsRecord] Error:', err);
          addNotification('error', 'Record Fetch Failed', err instanceof Error ? err.message : 'Could not fetch credits records from wallet.');
          return null;
        }
      }
      return null;
    },
    [connected, requestRecords, addNotification]
  );

  /**
   * Fetch a stablecoin Token record with at least `minAmount` balance.
   * Supports both USDCx and USAD token types.
   * Returns the record plaintext string to pass as a transaction input.
   */
  const fetchUsdcxRecord = useCallback(
    async (minAmount: number, tokenType: 'USDCX' | 'USAD' = 'USDCX'): Promise<string | null> => {
      if (!connected) {
        addNotification('error', 'Wallet Not Connected', 'Please connect your Shield Wallet first.');
        return null;
      }
      const programId = tokenType === 'USAD' ? 'usad_stablecoin.aleo' : 'usdcx_stablecoin.aleo';
      const label = tokenType === 'USAD' ? 'USAD' : 'USDCx';

      // Try up to 2 attempts — Shield wallet sometimes returns stale records on first call
      for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt > 0) {
          // Clear dedup on retry — wallet may return same records but they might
          // be valid (change records, or wallet re-synced). If truly spent,
          // the chain will reject and clearUsedRecords() handles it.
          clearUsedRecords();
          console.log(`[fetchUsdcxRecord] Retry ${label} after 1.5s (dedup cleared)...`);
          await new Promise(r => setTimeout(r, 1500));
        }
        try {
          const records = await requestRecords(programId, true);
          if (!records || records.length === 0) {
            if (attempt === 0) continue;
            addNotification('error', `No ${label} Records`, `No private ${label} token records found. You need private ${label} to trade.`);
            return null;
          }

          for (const rec of records) {
            const r = rec as Record<string, unknown>;
            if (r.spent) continue;

            let plaintext: string | undefined;
            if (typeof rec === 'string') {
              plaintext = rec;
            } else {
              plaintext = (r.recordPlaintext ?? r.plaintext) as string | undefined;
            }

            let amount = 0;
            if (plaintext) {
              const match = plaintext.match(/amount:\s*([\d_]+)u128/);
              if (match) amount = parseInt(match[1].replace(/_/g, ''), 10);
            }

            if (amount >= minAmount && plaintext) {
              if (isRecordRecentlyUsed(plaintext)) {
                console.log(`[fetchUsdcxRecord] Skipping recently-used ${label} record`);
                continue;
              }
              markRecordUsed(plaintext);
              return plaintext;
            }
          }

          // All records either spent or recently used — retry to let wallet sync
          if (attempt === 0) continue;
          addNotification('error', `Insufficient ${label}`, `No ${label} record with at least ${(minAmount / 1_000_000).toFixed(2)} ${label} found. Convert public ${label} to private first.`);
          return null;
        } catch (err) {
          if (attempt === 0) continue;
          console.error('[fetchUsdcxRecord] Error:', err);
          addNotification('error', `${label} Fetch Failed`, err instanceof Error ? err.message : `Could not fetch ${label} records.`);
          return null;
        }
      }
      return null;
    },
    [connected, requestRecords, addNotification]
  );

  const execute = useCallback(
    async (transaction: AleoTransaction, onConfirmed?: (realTxId: string) => void, onRejected?: (rawTxId: string) => void): Promise<string | null> => {
      if (!connected) {
        addNotification('error', 'Wallet Not Connected', 'Please connect your Shield Wallet first.');
        return null;
      }

      setStatus('preparing');
      setError(null);

      const TX_STEPS = [
        'Preparing transaction',
        'Waiting for wallet approval',
        'Generating ZK proof',
        'Broadcasting to network',
        'Confirming on-chain',
      ];

      // Show multi-step toast immediately
      const toastId = addNotification(
        'pending',
        'Transaction In Progress',
        `${transaction.functionName} on ${transaction.programId.replace('.aleo', '')}`,
        undefined,
        undefined,
      );
      // Set steps on the toast  
      updateNotification(toastId, { steps: TX_STEPS, currentStep: 0 });

      // Extract the record plaintext from inputs so we can blacklist it on rejection.
      // Records are always the first input that starts with "{ owner:" or contains "microcredits:" or "amount:".
      const usedRecordInput = transaction.inputs.find(
        (inp) => typeof inp === 'string' && (inp.includes('owner:') || inp.includes('microcredits:') || inp.includes('amount:'))
      );

      try {
        // Step 1 → 2: Waiting for wallet
        updateNotification(toastId, { currentStep: 1, message: 'Approve the transaction in your Shield Wallet' });
        setStatus('proving');

        const result = await executeTransaction({
          program: transaction.programId,
          function: transaction.functionName,
          inputs: transaction.inputs,
          fee: transaction.fee,
          privateFee: transaction.privateFee,
        });

        if (result?.transactionId) {
          const rawId = result.transactionId;
          setTxId(rawId);

          // Wallet accepted — mark confirmed immediately (don't block on chain resolution)
          setStatus('confirmed');

          // Show all steps completed + success toast instantly
          updateNotification(toastId, {
            type: 'success',
            title: 'Transaction Accepted',
            message: 'Wallet signed successfully. Fetching on-chain ID...',
            currentStep: 4,
          });

          // Fire onConfirmed immediately — each component schedules its own refresh cadence
          if (onConfirmed) {
            onConfirmed(rawId);
          }

          // Background: resolve real at1... ID then upgrade toast with explorer link.
          // If resolution fails after all retries, the TX was likely rejected on-chain.
          (async () => {
            try {
              const realId = await resolveShieldTxId(rawId);
              if (realId && realId.startsWith('at1')) {
                const explorerUrl = `${EXPLORER_BASE}/${realId}`;
                setTxId(realId);
                updateNotification(toastId, {
                  type: 'success',
                  title: 'Transaction Confirmed',
                  message: `TX: ${realId.slice(0, 12)}...${realId.slice(-8)}`,
                  currentStep: 5,
                  link: explorerUrl,
                  linkLabel: 'View on Explorer',
                });
              } else {
                // Could not resolve — doesn't mean rejected; API may be slow or ID format unsupported.
                // Keep the bet in the store — auto-resolve on Rounds page will handle it.
                console.warn('[TX] Could not resolve TX ID (keeping bet):', rawId);
                updateNotification(toastId, {
                  type: 'success',
                  title: 'Transaction Accepted',
                  message: 'Wallet signed successfully. Explorer link unavailable — your bet is saved.',
                  currentStep: 4,
                });
              }
            } catch {
              // Resolution error — network issue, not necessarily rejection.
              console.warn('[TX] Resolution error (keeping bet):', rawId);
              updateNotification(toastId, {
                type: 'success',
                title: 'Transaction Accepted',
                message: 'Wallet signed successfully. Explorer link unavailable — your bet is saved.',
                currentStep: 4,
              });
            }
          })();

          return rawId;
        }

        setStatus('error');
        updateNotification(toastId, {
          type: 'error',
          title: 'Transaction Failed',
          message: 'No transaction ID returned from wallet.',
          steps: undefined,
          currentStep: undefined,
        });
        return null;
      } catch (err) {
        const raw = err instanceof Error ? err.message : 'Transaction failed';
        let message = raw;
        let title = 'Transaction Failed';

        if (raw.includes('input ID') && raw.includes('already exists')) {
          title = 'Record Already Spent';
          message = 'Stale record detected — blacklisted. Please try again.';
          // Blacklist the specific record that caused this rejection permanently
          if (usedRecordInput) blacklistRecord(usedRecordInput);
          // Also clear dedup so next attempt finds a different record
          clearUsedRecords();
        } else if (raw.includes('insufficient') || raw.includes('balance')) {
          title = 'Insufficient Balance';
          message = 'Not enough credits to cover the bet and transaction fee.';
        } else if (raw.includes('User rejected') || raw.includes('cancelled') || raw.includes('denied')) {
          title = 'Transaction Cancelled';
          message = 'You cancelled the transaction in your wallet.';
        }

        setError(message);
        setStatus('error');
        updateNotification(toastId, {
          type: 'error',
          title,
          message,
          steps: undefined,
          currentStep: undefined,
        });
        return null;
      }
    },
    [connected, executeTransaction, addNotification, updateNotification]
  );

  /**
   * Poll the Aleo API for a confirmed transaction and return the real on-chain txId.
   * Useful when Shield Wallet returns a temporary ID.
   */
  const pollTransactionConfirmed = useCallback(
    async (txId: string, maxAttempts = 40, intervalMs = 5000): Promise<string | null> => {
      for (let i = 0; i < maxAttempts; i++) {
        try {
          const url = `${ALEO_API}/transaction/${txId}`;
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            const realId = data?.id || txId;
            return realId;
          }
        } catch { /* keep polling */ }
        await new Promise(r => setTimeout(r, intervalMs));
      }
      return null;
    },
    []
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setTxId(null);
    setError(null);
  }, []);

  /**
   * Fetch all OutcomeShare records from the wallet across all 3 programs.
   */
  const fetchShareRecords = useCallback(
    async (): Promise<ShareRecord[]> => {
      if (!connected) return [];
      try {
        const allRecords = await Promise.all([
          requestRecords(PROGRAM_ID, true).catch(() => []),
          requestRecords(PROGRAM_ID_CX, true).catch(() => []),
          requestRecords(PROGRAM_ID_SD, true).catch(() => []),
        ]);
        const records = allRecords.flat();
        const shares: ShareRecord[] = [];
        for (const rec of records) {
          const r = rec as Record<string, unknown>;
          if (r.spent) continue;
          const recordName = r.recordName as string | undefined;
          if (recordName !== 'OutcomeShare') continue;

          const plaintext = (r.recordPlaintext ?? r.plaintext) as string | undefined;
          if (!plaintext) continue;

          // Parse fields from plaintext
          const marketMatch = plaintext.match(/market_id:\s*(\d+field)/);
          const outcomeMatch = plaintext.match(/outcome:\s*(\d+)u8/);
          const quantityMatch = plaintext.match(/quantity:\s*(\d+)u128/);
          const tokenMatch = plaintext.match(/token_type:\s*(\d+)u8/);

          if (marketMatch && outcomeMatch && quantityMatch) {
            const quantity = parseInt(quantityMatch[1], 10);
            // Skip 0-quantity remainder records left over from sells
            if (quantity === 0) continue;
            shares.push({
              plaintext,
              marketId: marketMatch[1],
              outcome: parseInt(outcomeMatch[1], 10),
              quantity,
              tokenType: tokenMatch ? parseInt(tokenMatch[1], 10) : 0,
            });
          }
        }
        return shares;
      } catch (err) {
        console.error('[fetchShareRecords] Error:', err);
        return [];
      }
    },
    [connected, requestRecords]
  );

  /**
   * Fetch GovernanceReceipt records from the wallet.
   * Each receipt contains the real on-chain proposal_id (BHP256 hash).
   */
  const fetchGovernanceReceipts = useCallback(
    async (): Promise<string[]> => {
      if (!connected) return [];
      try {
        const records = await requestRecords(PROGRAM_ID, true);
        if (!records || records.length === 0) return [];
        const ids: string[] = [];
        for (const rec of records) {
          const r = rec as Record<string, unknown>;
          if (r.spent) continue;
          const recordName = r.recordName as string | undefined;
          if (recordName !== 'GovernanceReceipt') continue;
          const plaintext = (r.recordPlaintext ?? r.plaintext) as string | undefined;
          if (!plaintext) continue;
          const match = plaintext.match(/proposal_id:\s*([\d]+field)/);
          if (match) ids.push(match[1]);
        }
        return ids;
      } catch {
        return [];
      }
    },
    [connected, requestRecords]
  );

  return { status, txId, error, execute, reset, fetchCreditsRecord, fetchUsdcxRecord, fetchShareRecords, pollTransactionConfirmed, fetchGovernanceReceipts, connected };
}
