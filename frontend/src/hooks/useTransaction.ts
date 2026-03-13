import { useState, useCallback } from 'react';
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react';
import { useNotificationStore } from '@/stores/notificationStore';

type TransactionStatus = 'idle' | 'preparing' | 'proving' | 'broadcasting' | 'confirmed' | 'error';

export function useTransaction() {
  const [status, setStatus] = useState<TransactionStatus>('idle');
  const [txId, setTxId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { connected, executeTransaction } = useWallet();
  const { addNotification } = useNotificationStore();

  const execute = useCallback(
    async (transaction: { programId: string; functionName: string; inputs: string[]; fee: number; privateFee: boolean }) => {
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
          addNotification('success', 'Transaction Confirmed', `ID: ${result.transactionId.slice(0, 12)}...`);
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

  const reset = useCallback(() => {
    setStatus('idle');
    setTxId(null);
    setError(null);
  }, []);

  return { status, txId, error, execute, reset };
}
