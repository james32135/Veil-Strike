import { useState, useCallback } from 'react';
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react';
import { useNotificationStore } from '@/stores/notificationStore';
import { PROGRAM_ID, PROGRAM_ID_CX, PROGRAM_ID_SD, ALEO_TESTNET_API } from '@/constants';
import { resolveShieldTxId } from '@/utils/marketRegistration';
import type { AleoTransaction } from '@/types';

const EXPLORER_BASE = 'https://testnet.explorer.provable.com/transaction';

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
      try {
        const records = await requestRecords('credits.aleo', true);
        console.log('[fetchCreditsRecord] Raw records:', JSON.stringify(records, null, 2));

        if (!records || records.length === 0) {
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

          console.log('[fetchCreditsRecord] Record:', { plaintext: plaintext?.slice(0, 80), amount, spent, minMicrocredits });

          if (amount >= minMicrocredits && plaintext) {
            return plaintext;
          }
        }

        addNotification('error', 'Insufficient Credits', `No credits record with at least ${(minMicrocredits / 1_000_000).toFixed(2)} ALEO found. You may need to shield (make private) your public ALEO balance.`);
        return null;
      } catch (err) {
        console.error('[fetchCreditsRecord] Error:', err);
        addNotification('error', 'Record Fetch Failed', err instanceof Error ? err.message : 'Could not fetch credits records from wallet.');
        return null;
      }
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
      const programId = tokenType === 'USAD' ? 'test_usad_stablecoin.aleo' : 'test_usdcx_stablecoin.aleo';
      const label = tokenType === 'USAD' ? 'USAD' : 'USDCx';
      try {
        const records = await requestRecords(programId, true);
        if (!records || records.length === 0) {
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
            return plaintext;
          }
        }

        addNotification('error', `Insufficient ${label}`, `No ${label} record with at least ${(minAmount / 1_000_000).toFixed(2)} ${label} found. Convert public ${label} to private first.`);
        return null;
      } catch (err) {
        console.error('[fetchUsdcxRecord] Error:', err);
        addNotification('error', `${label} Fetch Failed`, err instanceof Error ? err.message : `Could not fetch ${label} records.`);
        return null;
      }
    },
    [connected, requestRecords, addNotification]
  );

  const execute = useCallback(
    async (transaction: AleoTransaction, onConfirmed?: (realTxId: string) => void) => {
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

          // Fire onConfirmed callback after short delay (data refresh)
          if (onConfirmed) {
            setTimeout(() => onConfirmed(rawId), 3000);
          }

          // Background: resolve real at1... ID then upgrade toast with explorer link
          (async () => {
            try {
              const realId = await resolveShieldTxId(rawId);
              const confirmedId = (realId && realId.startsWith('at1')) ? realId : rawId;
              const explorerUrl = confirmedId.startsWith('at1')
                ? `${EXPLORER_BASE}/${confirmedId}`
                : undefined;

              setTxId(confirmedId);
              updateNotification(toastId, {
                type: 'success',
                title: 'Transaction Confirmed',
                message: confirmedId.startsWith('at1')
                  ? `TX: ${confirmedId.slice(0, 12)}...${confirmedId.slice(-8)}`
                  : 'Transaction accepted by the network',
                currentStep: 5,
                link: explorerUrl,
                linkLabel: 'View on Explorer',
              });
            } catch {
              // Resolution failed — toast already shows success
              updateNotification(toastId, {
                type: 'success',
                title: 'Transaction Confirmed',
                message: 'Transaction accepted. Explorer link unavailable.',
                currentStep: 5,
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
          message = 'This credits record was already used. Wait ~30s for it to confirm, then try again.';
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
          const url = `${ALEO_TESTNET_API}/transaction/${txId}`;
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
