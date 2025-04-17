// components/SendTransactionButton.tsx
'use client'

import { useSendTransaction, useAccount } from 'wagmi'
import { useState } from 'react'
import { parseEther } from 'viem'

export function SendTransactionButton() {
  const { isConnected } = useAccount()
  const { sendTransaction, isPending, error } = useSendTransaction()
  const [txHash, setTxHash] = useState<string | null>(null)

  const handleSendTransaction = () => {
    if (!isConnected) {
      alert('Please connect your wallet first')
      return
    }

    sendTransaction(
      {
        to: '0xfF8b7625894441C26fEd460dD21360500BF4E767',
        value: parseEther('0'), // Sending 0 MON
      },
      {
        onSuccess: (hash) => {
          setTxHash(hash)
        },
        onError: (err) => {
          console.error('Transaction error:', err)
        },
      }
    )
  }

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
          Transaction sent! Hash: <a
            href={`https://testnet.monadexplorer.com/tx/${txHash}`} // Replace with actual Monad Testnet explorer URL
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 underline"
          >
            {txHash.slice(0, 6)}...{txHash.slice(-4)}
          </a>
        </div>
      )}
      {error && (
        <div className="mt-2 text-sm text-red-500">
          Error: {error.message}
        </div>
      )}
    </div>
  )
}