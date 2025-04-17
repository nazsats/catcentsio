// components/ConnectWalletButton.tsx
'use client'

import { useAccount, useDisconnect } from 'wagmi'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useAppKit } from '@reown/appkit/react'

export function ConnectWalletButton() {
  const { open } = useAppKit()
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const router = useRouter()

  useEffect(() => {
    if (isConnected) {
      router.push('/dashboard')
    }
  }, [isConnected, router])

  return (
    <div>
      {isConnected ? (
        <div>
          <span>Connected: {address?.slice(0, 6)}...{address?.slice(-4)}</span>
          <button
            onClick={() => disconnect()}
            className="ml-2 px-4 py-2 bg-red-500 text-white rounded"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <button
          onClick={() => open()}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Connect Wallet
        </button>
      )}
    </div>
  )
}