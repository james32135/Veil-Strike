import { useState, useCallback } from 'react';
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react';
import { useNotificationStore } from '@/stores/notificationStore';
import { PROGRAM_ID, PROGRAM_ID_CX, PROGRAM_ID_SD, ALEO_TESTNET_API } from '@/constants';
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
  const { addNotification } = useNotificationStore();

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
    async (transaction: AleoTransaction) => {
      if (!connected) {
        addNotification('error', 'Wallet Not Connected', 'Please connect your Shield Wallet first.');
        return null;
      }

      setStatus('preparing');
      setError(null);

      try {
        addNotification('info', 'Transaction Preparing', `Executing ${transaction.functionName}...`);
        setStatus('proving');

        const result = await executeTransaction({
          program: transaction.programId,
          function: transaction.functionName,
          inputs: transaction.inputs,
          fee: transaction.fee,
          privateFee: transaction.privateFee,
        });

        if (result?.transactionId) {
          setTxId(result.transactionId);
          setStatus('confirmed');
          const explorerUrl = `${EXPLORER_BASE}/${result.transactionId}`;
          addNotification(
            'success',
            'Transaction Submitted',
            `TX: ${result.transactionId.slice(0, 16)}...`,
            explorerUrl,
            'View on Explorer'
          );
          return result.transactionId;
        }

        setStatus('error');
        addNotification('error', 'Transaction Failed', 'No transaction ID returned.');
        return null;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Transaction failed';
        setError(message);
        setStatus('error');
        addNotification('error', 'Transaction Failed', message);
        return null;
      }
    },
    [connected, executeTransaction, addNotification]
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
