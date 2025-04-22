'use client';

import { useSendTransaction, useAccount, useChainId } from 'wagmi';
import { useState } from 'react';
import { parseEther, createPublicClient, http } from 'viem';
import toast from 'react-hot-toast';
import { monadTestnet } from '@reown/appkit/networks';
import pRetry from 'p-retry';

export function SendTransactionButton() {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const { sendTransaction, isPending } = useSendTransaction();
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleSendTransaction = async () => {
    if (!isConnected || !address) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (chainId !== monadTestnet.id) {
      toast.error('Please switch to Monad Testnet in your wallet.');
      return;
    }

    const pendingToast = toast.loading('Processing transaction...');
    try {
      const publicClient = createPublicClient({
        chain: monadTestnet,
        transport: http(),
      });
      const gasEstimate = await publicClient.estimateGas({
        account: address,
        to: '0xfF8b7625894441C26fEd460dD21360500BF4E767',
        value: parseEther('0'),
      });
      const gasPrice = await publicClient.getGasPrice();

      await pRetry(
        () =>
          sendTransaction(
            {
              to: '0xfF8b7625894441C26fEd460dD21360500BF4E767',
              value: parseEther('0'),
              gas: gasEstimate,
              gasPrice,
            },
            {
              onSuccess: (hash) => {
                setTxHash(hash);
                toast.dismiss(pendingToast);
                toast.success(
                  <div>
                    Transaction sent!{' '}
                    <a
                      href={`https://testnet.monadscan.com/tx/${hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-blue-500"
                    >
                      View on MonadScan
                    </a>
                  </div>,
                  { duration: 5000 }
                );
              },
              onError: (err) => {
                console.error('Transaction error:', err, JSON.stringify(err, null, 2));
                toast.dismiss(pendingToast);
                if (err.message.includes('Internal JSON-RPC error')) {
                  toast.error('Reconnect your wallet or try again later.', { duration: 5000 });
                } else if (err.message.includes('user denied') || err.message.includes('User rejected')) {
                  toast.error('You rejected the transaction.', { duration: 5000 });
                } else if (err.message.includes('insufficient funds')) {
                  toast.error(
                    <div>
                      Insufficient MON balance.{' '}
                      <a
                        href="https://faucet.monad.xyz/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline text-blue-500"
                      >
                        Claim MON tokens
                      </a>
                    </div>,
                    { duration: 5000 }
                  );
                } else {
                  toast.error(`Transaction failed: ${err.message}`, { duration: 5000 });
                }
              },
            }
          ),
        {
          retries: 3,
          minTimeout: 1000,
          onFailedAttempt: (error) => {
            console.warn(`Retry attempt failed: ${error.message}`);
          },
        }
      );
    } catch (error: unknown) {
      console.error('Transaction error:', error);
      toast.dismiss(pendingToast);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Transaction failed: ${errorMessage}`, { duration: 5000 });
    }
  };

  return (
    <div className="flex flex-col items-center">
      <button
        onClick={handleSendTransaction}
        disabled={isPending || !isConnected}
        className={`px-4 py-2 rounded text-white ${
          isPending || !isConnected ? 'bg-gray-500 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600'
        }`}
      >
        {isPending ? 'Sending...' : 'Send 0 MON'}
      </button>
      {txHash && (
        <div className="mt-2 text-sm">
          Transaction sent! Hash:{' '}
          <a
            href={`https://testnet.monadscan.com/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 underline"
          >
            {txHash.slice(0, 6)}...{txHash.slice(-4)}
          </a>
        </div>
      )}
    </div>
  );
}